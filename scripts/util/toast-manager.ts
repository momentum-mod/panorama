import { getOrCreateGlobal } from './module-helpers';
import * as Enum from './enum';
import { compareDeep } from './functions';

export enum ToastLocation {
	LEFT = 0,
	CENTER = 1,
	RIGHT = 2
}
const DEFAULT_TOAST_DURATION = 10;
const MAX_ACTIVE_TOASTS = 10;
const HIDE_TRANSITION_DURATION = 0.3; // This should match transition-duration properties in toast.scss

export enum ToastStyle {
	INFO = 'info',
	SUCCESS = 'success',
	WARNING = 'warning',
	ERROR = 'error',
	BLUE = 'blue',
	RED = 'red',
	GREEN = 'green',
	ORANGE = 'orange'
}

export class ToastError extends Error {
	constructor(message: string) {
		super(`ToastManager: ${message}`);
		this.name = 'ToastError';
	}
}

export type ToastCreateArgs = ({ title: string; message?: string } | { title?: string; message: string }) & {
	icon?: string;
	duration?: number;
	location?: ToastLocation;
	style?: ToastStyle | string;
	id?: string;
	parameters?: Record<string, any>;
};

export interface ToastCreateWithLayoutArgs {
	layoutFile: string;
	duration?: number;
	location?: ToastLocation;
	style?: ToastStyle | string;
	id?: string;
	parameters?: Record<string, any>;
}

class Toast {
	readonly style: string;
	readonly id: string;
	readonly title: string;
	readonly message: string;
	readonly icon: string;
	readonly duration: number;
	readonly layoutFile: string;
	readonly location: ToastLocation;
	readonly parameters: Record<string, any>;

	panel: GenericPanel;
	expiring: boolean;
	schedulerHandle: uuid;

	constructor(args: {
		layoutFile?: string;
		title?: string;
		message?: string;
		icon?: string;
		duration?: number;
		location?: ToastLocation;
		style?: string;
		id?: string;
		parameters?: Record<string, any>;
	}) {
		if (!args.layoutFile && !args.title && !args.message) {
			throw new ToastError('Invalid Toast object without title, message, or custom layout.');
		}

		if (args.duration != null && Number.isNaN(+args.duration)) {
			throw new ToastError(
				`Toast object created with invalid duration: value "${args.duration}" type "${typeof args.duration}".`
			);
		}

		if (args.location != null && !Enum.values(ToastLocation).includes(args.location)) {
			throw new ToastError("Toast object created with invalid location. Must be one of 'ToastLocation'.");
		}

		if (args.layoutFile) {
			this.layoutFile = args.layoutFile;
			this.parameters = args.parameters;
		} else {
			this.title = args.title;
			this.message = args.message;
			this.icon = args.icon;
		}

		this.duration = args.duration && !Number.isNaN(+args.duration) ? args.duration : DEFAULT_TOAST_DURATION;
		this.location = args.location ?? ToastLocation.RIGHT;
		this.style = args.style;
		this.id = args.id ?? '';

		this.schedulerHandle = null;
		this.panel = null;
		this.expiring = false;
	}

	isIdenticalTo(other: Toast) {
		return (
			(this.id && this.id === other.id) ||
			(this.layoutFile === other.layoutFile &&
				this.title === other.title &&
				this.message === other.message &&
				this.icon === other.icon &&
				this.duration === other.duration &&
				this.location === other.location &&
				this.style === other.style &&
				(!this.parameters || !other.parameters || compareDeep(this.parameters, other.parameters)))
		);
	}
}

class ToastManagerInternal {
	private readonly activeToasts: Map<ToastLocation, Toast[]> = new Map(
		Enum.values(ToastLocation).map((loc) => [loc, []])
	);
	private readonly queuedToasts: Map<ToastLocation, Toast[]> = new Map(
		Enum.values(ToastLocation).map((loc) => [loc, []])
	);
	private readonly containers: ReadonlyMap<ToastLocation, Panel> = new Map([
		[ToastLocation.LEFT, $('#Left')],
		[ToastLocation.CENTER, $('#Center')],
		[ToastLocation.RIGHT, $('#Right')]
	]);
	private readonly classes: ReadonlyMap<ToastLocation, string> = new Map([
		[ToastLocation.LEFT, 'toast--left'],
		[ToastLocation.CENTER, 'toast--center'],
		[ToastLocation.RIGHT, 'toast--right']
	]);

	constructor() {
		$.RegisterForUnhandledEvent('Toast_Show', (id, title, message, location, duration, icon, style) =>
			this.createToast({ id, title, message, location, duration, style, icon })
		);
		$.RegisterForUnhandledEvent('Toast_ShowCustom', (id, layoutFile, location, duration, parameters) =>
			this.createToastWithLayout({ id, layoutFile, location, duration, parameters })
		);
		$.RegisterForUnhandledEvent('Toast_Delete', (id) => this.deleteToastByID(id));
		$.RegisterForUnhandledEvent('Toast_Clear', (location) => this.clearToasts(location));
	}

	/** Create a standard text-based toast. Either a title or message is required. */
	createToast(toastArgs: ToastCreateArgs) {
		this.createToastInternal(toastArgs);
	}

	/** Create a toast with a custom layout file. */
	createToastWithLayout(toastArgs: ToastCreateWithLayoutArgs) {
		this.createToastInternal(toastArgs);
	}

	private createToastInternal(toastArgs: ToastCreateArgs | ToastCreateWithLayoutArgs): void {
		if (!toastArgs) return;

		const toast = new Toast(toastArgs);

		const existingToast = this.activeToasts.get(toast.location).find((t) => t.isIdenticalTo(toast));
		if (existingToast) {
			if (existingToast.schedulerHandle) {
				$.CancelScheduled(existingToast.schedulerHandle);
			}

			this.activeToasts
				.get(existingToast.location)
				.splice(this.activeToasts.get(existingToast.location).indexOf(existingToast), 1);

			existingToast.panel.TriggerClass('toast--wiggle');

			this.initToastBehaviour(existingToast);
		} else if (this.queuedToasts.get(toast.location).some((t) => t.isIdenticalTo(toast))) {
			return;
		} else if (this.activeToasts.get(toast.location).length <= MAX_ACTIVE_TOASTS) {
			this.createToastImmediately(toast);
		} else {
			this.queueToast(toast);
		}
	}

	/** Delete Toast by its panel ID */
	deleteToastByID(toastID: string) {
		if (!toastID) return;

		this.activeToasts
			.values()
			.toArray()
			.flat()
			.filter(({ id }) => id === toastID)
			.forEach((toast) => this.deleteToast(toast));
	}

	/** Delete a given Toast instance */
	deleteToast(toast: Toast) {
		if (!toast) return;

		if (toast.schedulerHandle) {
			$.CancelScheduled(toast.schedulerHandle);
		}

		this.toastExpire(toast);
	}

	clearToasts(location?: ToastLocation | -1) {
		// Panorama/JS doesn't run this synchronously for some reason, so put a slight delay between deletions. Also looks kinda cool!
		if (location != null && location !== -1) {
			let delay = 0;
			for (const toast of this.activeToasts.get(location)) {
				$.Schedule(delay, () => this.deleteToast(toast));
				delay += 0.05;
			}

			this.queuedToasts.set(location, []);
		} else {
			for (const location of Enum.values(ToastLocation)) {
				let delay = 0;
				for (const toast of this.activeToasts.get(location)) {
					$.Schedule(delay, () => this.deleteToast(toast));
					delay += 0.05;
				}
				this.queuedToasts.set(location, []);
			}
		}
	}

	private createToastImmediately(toast: Toast) {
		const container = this.containers.get(toast.location);
		const locationClass = this.classes.get(toast.location);

		if (toast.layoutFile) {
			toast.panel = $.CreatePanel('Panel', container, toast.id, {
				class: locationClass,
				...toast.parameters
			});
			toast.panel.LoadLayout(toast.layoutFile, false, false);
		} else {
			toast.panel = $.CreatePanel('ToastGeneric', container, toast.id, { class: locationClass });

			if (toast.style) {
				toast.panel.AddClass(`toast-generic--${toast.style}`);
			}

			if (toast.title)
				toast.panel.SetDialogVariable(
					'toast_title',
					toast.title.startsWith('#') ? $.Localize(toast.title) : toast.title
				);

			if (toast.message)
				toast.panel.SetDialogVariable(
					'toast_message',
					toast.message.startsWith('#') ? $.Localize(toast.message) : toast.message
				);

			toast.panel.FindChildInLayoutFile('Title').SetHasClass('hide', !toast.title);

			const iconPanel = toast.panel.FindChildInLayoutFile<Image>('Icon');
			if (toast.icon) {
				iconPanel.SetImage(`file://{images}/${toast.icon}.svg`);
			} else {
				iconPanel.AddClass('hide');
			}
		}

		const handle = $.RegisterEventHandler('PropertyTransitionEnd', toast.panel, (_, propertyName) => {
			if (propertyName !== 'opacity') return;

			// This is a hacky way of ensuring height animations work properly. Panorama can't interpolate something with height set to fit-children;
			// it needs a fixed height. This waits for the loading anim to finish, then explicitly sets the height property to its actual height.
			// Annoyingly, this causes an anim bug so we have to remove the transition duration temporarily (and Panorama can't get its initial value because Valve are really smart)
			$.UnregisterEventHandler('PropertyTransitionEnd', toast.panel, handle);
			toast.panel.style.transitionDuration = '0s';
			toast.panel.style.height = `${toast.panel.actuallayoutheight / toast.panel.actualuiscale_y}px`;
			toast.panel.style.transitionDuration = HIDE_TRANSITION_DURATION + 's';
		});

		toast.panel.AddClass('toast--show');

		this.initToastBehaviour(toast);
	}

	private queueToast(toast: Toast) {
		this.queuedToasts.get(toast.location).push(toast);
	}

	private initToastBehaviour(toast: Toast) {
		// -1 duration for an everlasting toast
		if (toast.duration !== -1) {
			toast.schedulerHandle = $.Schedule(toast.duration, () => this.toastExpire(toast));
		}

		this.activeToasts.get(toast.location).push(toast);
	}

	private toastExpire(toast: Toast) {
		if (toast.expiring) return;

		toast.expiring = true;
		toast.panel.AddClass('toast--hide');
		toast.panel.style.height = '0px';

		this.activeToasts.get(toast.location).splice(this.activeToasts.get(toast.location).indexOf(toast), 1);

		this.onToastExpired(toast.location);

		$.RegisterEventHandler('PropertyTransitionEnd', toast.panel, (_, propertyName) => {
			if (propertyName === 'opacity') {
				toast.panel.DeleteAsync(0);
			}
		});
	}

	private onToastExpired(location: ToastLocation) {
		if (this.queuedToasts.get(location).length > 0) {
			this.createToastImmediately(this.queuedToasts.get(location)[0]);
			this.queuedToasts.get(location).shift();
		}
	}
}

/**
 * Class for creating toasts. Unlike others modals, using UiToolkitAPI, this is all in JS. Just import ToastManager to
 * use it.
 */
export const ToastManager = getOrCreateGlobal('ToastManager', ToastManagerInternal);
