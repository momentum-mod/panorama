import { PanelHandler } from 'util/module-helpers';
import { parseMapImageUrl } from 'util/functions';
import { MapCreditType } from 'common/web/enums/map-credit-type.enum';
import * as Maps from 'common/maps';
/**
 * Fullscreen gallery component.
 * Currently dependent on Map Selector functionality to work, could be generalized in future if needed.
 */
@PanelHandler({ exposeToPanel: true })
export class GalleryHandler {
	readonly panels = {
		top: $<Panel>('#Top'),
		mainImage: $<Image>('#MainImage'),
		thumbnails: $('#Thumbnails'),
		credits: $<Panel>('#Credits'),
		descLabel: $<Label>('#Description'),
		bottom: $<Panel>('#Bottom'),
		imageContainer: $<Panel>('#ImageContainer')
	};

	readonly strings = {
		credits: new Map([
			[MapCreditType.AUTHOR, '#MapSelector_Info_Authors'],
			[MapCreditType.CONTRIBUTOR, '#MapSelector_Info_Contributors'],
			[MapCreditType.SPECIAL_THANKS, '#MapSelector_Info_SpecialThanks'],
			[MapCreditType.TESTER, '#MapSelector_Info_Testers']
		]),
		placeholder: $.Localize('#MapSelector_Info_Placeholder')
	};

	init(mapSelector: MomentumMapSelector, staticData: MapCacheAPI.StaticData) {
		const imageIDs = staticData.images?.map(({ id }) => id) ?? [];

		if (imageIDs.length === 0) {
			$.Warning('GalleryHandler: No images provided, cannot initialize gallery.');
			return;
		}

		this.panels.top.SetDialogVariable('name', staticData.name);

		const baseUrl = parseMapImageUrl(staticData) ?? '';

		const thumbs = imageIDs.map((id, i) => {
			const thumbnail = $.CreatePanel('Image', this.panels.thumbnails, '', {
				src: `file://{images}/gallery/${id}.jpg`,
				class: 'gallery__thumbnail'
			});

			if (i === 0) {
				thumbnail.AddClass('gallery__thumbnail--first');
			}

			mapSelector.applyMapImageToImagePanel(thumbnail, id, true, baseUrl);

			thumbnail.SetPanelEvent('onactivate', () =>
				mapSelector.applyMapImageToImagePanel(this.panels.mainImage, id, false, baseUrl)
			);

			return thumbnail;
		});

		this.updateCredits(staticData);
		this.updateDescription(staticData);

		// TODO: Waiting for panorama layouting, figure out if onlayout event for panels is possible
		$.Schedule(0.1, () => this.scaleImageContainer());

		$.DispatchEvent('Activated', thumbs[0], PanelEventSource.MOUSE);
	}

	scaleImageContainer() {
		const parent = this.panels.bottom;
		const container = this.panels.imageContainer;

		// Layout size - padding ( currently 8px everywhere )
		const availableWidth = parent.actuallayoutwidth - 16;
		const availableHeight = parent.actuallayoutheight - 16;

		const targetRatio = 16 / 9;

		let finalWidth = availableWidth;
		let finalHeight = availableWidth / targetRatio;

		// If the calculated height overflows, clamp it by height instead
		if (finalHeight > availableHeight) {
			finalHeight = availableHeight;
			finalWidth = availableHeight * targetRatio;
		}

		container.style.width = `${finalWidth}px`;
		container.style.height = `${finalHeight}px`;
	}

	updateCredits(staticData: MapCacheAPI.StaticData) {
		this.panels.credits.RemoveAndDeleteChildren();

		this.strings.credits
			.entries()
			// Map to collections of both regular and placeholder suggestions, filter out empty credit types
			.map(([type, heading]) => [heading, Maps.getAllCredits(staticData, type)] as const)
			.filter(([_heading, credits]) => credits.length > 0)
			.forEach(([heading, credits]) => {
				// One row container per credit type
				const typeRow = $.CreatePanel('Panel', this.panels.credits, '', {
					class: 'gallery__credits-type-row'
				});

				$.CreatePanel('Label', typeRow, '', {
					text: $.Localize(heading),
					class: 'gallery__h2'
				});

				// Grid container for this type's entries, 2 per row
				const grid = $.CreatePanel('Panel', typeRow, '', {
					class: 'gallery__credits-grid'
				});

				credits.forEach(({ alias, steamID }, i) => {
					const entryRow =
						i % 2 === 0
							? $.CreatePanel('Panel', grid, '', { class: 'gallery__credits-row' })
							: grid.Children().at(-1);

					const panel = $.CreatePanel('Panel', entryRow, '', { class: 'gallery__credits-credit' });

					if (steamID) {
						$.CreatePanel('AvatarImage', panel, '', {
							class: 'gallery__credits-avatar',
							steamid: steamID
						});
					} else {
						const placeholder = $.CreatePanel('Image', panel, `Placholder${i}`, {
							class: 'gallery__credits-placeholder',
							src: 'file://{images}/help.svg',
							textureheight: '32px'
						});
						placeholder.SetPanelEvent('onmouseover', () =>
							UiToolkitAPI.ShowTextTooltip(placeholder.id, this.strings.placeholder)
						);
						placeholder.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
					}

					const namePanel = $.CreatePanel('Label', panel, '', {
						text: alias,
						class: 'gallery__credits-text gallery__credits-name'
					});

					if (steamID) {
						namePanel.AddClass('gallery__credits-name--steam');
						// This will become a player profile panel in the future
						panel.SetPanelEvent('onactivate', () => {
							UiToolkitAPI.ShowSimpleContextMenu(namePanel.id, '', [
								{
									label: $.Localize('#Action_ShowSteamProfile'),
									jsCallback: () => SteamOverlayAPI.OpenToProfileID(steamID)
								}
							]);
						});
					}
				});
			});

		// Wait for panorama layouting
		$.Schedule(0.05, () => {
			const maxHeight = this.panels.credits.GetParent()!.actuallayoutheight * 0.43;
			if (this.panels.credits.actuallayoutheight > maxHeight) {
				this.panels.credits.style.height = `${maxHeight}px`;
				this.panels.credits.style.overflow = 'scroll';
			} else {
				this.panels.credits.style.overflow = 'clip';
			}
		});
	}

	updateDescription(staticData: MapCacheAPI.StaticData) {
		const description = staticData.info.description;
		this.panels.descLabel.text = description;
	}
}
