import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { PanelHandler } from 'util/module-helpers';

@PanelHandler({ exposeToPanel: true })
export class GroupPillHandler {
	readonly panels = {
		cp: $.GetContextPanel<GroupPill>(),
		label: $<Label>('#GroupPillLabel')
	};

	setGroup(group: CompletionGroup) {
		// Pills are reused (e.g. the track selector across style switches), so strip whatever group
		// class a previous group applied -- its background paints via group-pill--<NAME> CSS and would
		// otherwise linger when the group is cleared or changes.
		for (const name of Object.values(CompletionGroup)) {
			if (typeof name === 'string') this.panels.cp.RemoveClass(`group-pill--${name}`);
		}

		if (group == null) {
			this.panels.label.text = '';
			return;
		}

		const groupName = CompletionGroup[group];

		if (group === CompletionGroup.WORLD_RECORD) {
			this.panels.label.text = 'WR';
		} else if (group === CompletionGroup.TOP_10) {
			this.panels.label.text = 'TOP10';
		} else {
			// Restore the G{i:group} template a prior WR/TOP10 render may have overwritten via .text.
			this.panels.cp.SetDialogVariableInt('group', group - 1);
			this.panels.label.SetTextWithDialogVariables('G{i:group}');
		}

		this.panels.cp.AddClass(`group-pill--${groupName}`);
	}
}
