import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { PanelHandler } from 'util/module-helpers';

@PanelHandler({ exposeToPanel: true })
export class GroupPillHandler {
	readonly panels = {
		cp: $.GetContextPanel<GroupPill>(),
		label: $<Label>('#GroupPillLabel')
	};

	setGroup(group: CompletionGroup) {
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
			this.panels.cp.SetDialogVariableInt('group', group - 1);
		}

		this.panels.cp.AddClass(`group-pill--${groupName}`);
	}
}
