'use strict';

const TOAST_DURATION = 10;
const MAX_ACTIVE_TOASTS = 10;
const LOCATIONS = ['left', 'center', 'right'];
const HIDE_TRANSITION_DURATION = 0.3; // This should match transition-duration properties in toast.scss

class Toast {
	constructor(obj) {
		if (obj.customLayout) {
			this.customLayout = obj.customLayout;
			this.parameters = obj.parameters;
		} else {
			if (!obj.title && !obj.message) {
				throw 'Invalid Toast object without title, message, or custom layout.';
			}
			this.title = obj.title;
			this.message = obj.message;
			this.icon = obj.icon;
		}

		if (obj.duration && obj.duration !== '' && isNaN(obj.duration)) {
			throw `Toast object created with invalid duration: value "${obj.duration}" type "${typeof obj.duration}".`;
		}

		this.duration = obj.duration && obj.duration !== '' ? obj.duration : TOAST_DURATION;
		this.location = LOCATIONS.includes(obj.location) ? obj.location : 'center';
		this.style = obj.style;
		this.id = obj.id ?? '';

		this.schedulerHandle = null;
		this.panel = null;
		this.expiring = false;
	}

	isIdenticalTo(toast) {
		return (
			(this.id && this.id === toast.id) ||
			(this.customLayout === toast.customLayout &&
				this.parameters === toast.parameters &&
				this.title === toast.title &&
				this.message === toast.message &&
				this.icon === toast.icon &&
				this.duration === toast.duration &&
				this.location === toast.location &&
				this.style === toast.style)
		);
	}
}

const ToastFactory = {
	create(obj) {
		try {
			return new Toast(obj);
		} catch (e) {
			$.Warning('Toast Manager ' + e);
			return null;
		}
	}
};

class ToastManager {
	// { left: [], ...}
	static activeToasts = LOCATIONS.reduce((obj, loc) => {
		obj[loc] = [];
		return obj;
	}, {});

	static queuedToasts = LOCATIONS.reduce((obj, loc) => {
		obj[loc] = [];
		return obj;
	}, {});

	// { left: $('#Left'), ...}
	static containers = LOCATIONS.reduce((obj, loc) => {
		obj[loc] = $('#' + loc[0].toUpperCase() + loc.substring(1));
		return obj;
	}, {});

	static {
		$.RegisterForUnhandledEvent('Toast_Show', (id, title, message, location, duration, style, icon) =>
			this.queueToast(
				ToastFactory.create({
					id: id,
					title: title,
					message: message,
					location: location,
					duration: duration,
					style: style,
					icon: icon
				})
			)
		);

		$.RegisterForUnhandledEvent('Toast_ShowCustom', (id, layoutFile, location, duration, parameters) =>
			this.queueToast(
				ToastFactory.create({
					id: id,
					customLayout: layoutFile,
					location: location,
					duration: duration,
					parameters: parameters
				})
			)
		);

		$.RegisterForUnhandledEvent('Toast_Delete', this.deleteToastByID.bind(this));
		$.RegisterForUnhandledEvent('Toast_Clear', this.clearToasts.bind(this));
	}

	static queueToast(toast) {
		if (!toast) return;

		const existingToast = this.activeToasts[toast.location].find((t) => t.isIdenticalTo(toast));
		if (existingToast) {
			if (existingToast.schedulerHandle) {
				$.CancelScheduled(existingToast.schedulerHandle);
			}

			this.activeToasts[existingToast.location].splice(this.activeToasts[existingToast.location].indexOf(existingToast), 1);

			existingToast.panel.TriggerClass('toast--wiggle');

			this.initToastBehaviour(existingToast);
		} else if (this.queuedToasts[toast.location].find((t) => t.isIdenticalTo(toast))) {
			return;
		} else if (this.activeToasts[toast.location].length <= MAX_ACTIVE_TOASTS) {
			this.createToast(toast);
		} else {
			this.queuedToasts[toast.location].push(toast);
		}
	}

	static createToast(toast) {
		const container = this.containers[toast.location];
		const locationClass = `toast--${toast.location}`;

		if (toast.customLayout) {
			toast.panel = $.CreatePanel('Panel', container, toast.id, { class: locationClass });
			toast.panel.LoadLayout(toast.customLayout, false, false);

			if (toast.parameters) {
				toast.parameters.split('&').forEach((param) => {
					const split = param.split('=');
					toast.panel.SetAttributeString(split[0], split[1]);
				});
			}
		} else {
			toast.panel = $.CreatePanel('ToastGeneric', container, toast.id, { class: locationClass });

			if (toast.style) {
				toast.panel.AddClass(`toast-generic--${toast.style}`);
			}

			toast.panel.SetDialogVariable('toast_title', toast.title);
			toast.panel.SetDialogVariable('toast_message', toast.message);

			toast.panel.FindChildInLayoutFile('Title').SetHasClass('hide', !toast.title);

			const iconPanel = toast.panel.FindChildInLayoutFile('Icon');
			toast.icon ? iconPanel.SetImage(`file://{images}/${toast.icon}.svg`) : iconPanel.AddClass('hide');
		}

		const handle = $.RegisterEventHandler('PropertyTransitionEnd', toast.panel, (_, propertyName) => {
			if (propertyName === 'opacity') {
				// This is a hacky way of ensuring height animations work properly. Panorama can't interpolate something with height set to fit-children;
				// it needs a fixed height. This waits for the loading anim to finish, then explicitly sets the height property to its actual height.
				// Annoyingly, this causes an anim bug so we have to remove the transition duration temporarily (and Panorama can't get its initial value because Valve are really smart)
				$.UnregisterEventHandler('PropertyTransitionEnd', toast.panel, handle);
				toast.panel.style.transitionDuration = '0s';
				toast.panel.style.height = `${toast.panel.actuallayoutheight / toast.panel.actualuiscale_y}px`;
				toast.panel.style.transitionDuration = HIDE_TRANSITION_DURATION + 's';
			}
		});

		toast.panel.AddClass('toast--show');

		this.initToastBehaviour(toast);
	}

	static initToastBehaviour(toast) {
		// -1 duration for an everlasting toast
		if (toast.duration !== -1) {
			toast.schedulerHandle = $.Schedule(toast.duration, () => this.toastExpire(toast));
		}

		this.activeToasts[toast.location].push(toast);
	}

	static toastExpire(toast) {
		if (toast.expiring) return;

		toast.expiring = true;

		toast.panel.AddClass('toast--hide');

		toast.panel.style.height = '0px';

		this.activeToasts[toast.location].splice(this.activeToasts[toast.location].indexOf(toast), 1);

		this.onToastExpired(toast.location);

		$.RegisterEventHandler('PropertyTransitionEnd', toast.panel, (_, propertyName) => {
			if (propertyName === 'opacity') {
				toast.panel.DeleteAsync(0.0);
			}
		});
	}

	static onToastExpired(location) {
		if (this.queuedToasts[location].length > 0) {
			this.createToast(this.queuedToasts[location][0]);
			this.queuedToasts[location].shift();
		}
	}

	static deleteToastByID(toastID) {
		if (!toastID) return;

		LOCATIONS.forEach((loc) => this.deleteToast(this.activeToasts[loc].find((t) => t.id === toastID)));
	}

	static deleteToast(toast) {
		if (!toast) return;

		if (toast.schedulerHandle) $.CancelScheduled(toast.schedulerHandle);

		this.toastExpire(toast);
	}

	static clearToasts(location) {
		// Panorama/JS doesn't run this syncronously for some reason, so put a slight delay between deletions. Also looks kinda cool!
		let delay = 0;
		if (location && location !== 'all') {
			if (!LOCATIONS.includes(location)) return;

			this.activeToasts[location].forEach((toast) => {
				$.Schedule(delay, () => this.deleteToast(toast));
				delay += 0.05;
			});

			this.queuedToasts[location] = [];
		} else {
			LOCATIONS.forEach((l) => {
				this.activeToasts[l].forEach((toast) => {
					$.Schedule(delay, () => this.deleteToast(toast));
					delay += 0.05;
				});
				this.queuedToasts[location] = [];
			});
		}
	}
}
