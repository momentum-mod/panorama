import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { TruenessMode } from 'hud/cgaz';

const truenessCvar = 'mom_hud_df_prime_trueness_mode';

@PanelHandler()
class PrimeSightSettingsHandler implements OnPanelLoad {
    readonly truenessSetting = $('#TruenessSetting');
    readonly bits = {
		ground: this.truenessSetting.FindChildTraverse<ToggleButton>('GroundTrueness')!,
		projected: this.truenessSetting.FindChildTraverse<ToggleButton>('ProjectedTrueness')!,
		cpmTurn: this.truenessSetting.FindChildTraverse<ToggleButton>('CPMTurnTrueness')!
	};

	constructor() {
		$.RegisterConVarChangeListener(truenessCvar, () => this.setCheckboxState());
	}

	onPanelLoad() {
		this.setCheckboxState();
	}

    setCheckboxState() {
        const setting = GameInterfaceAPI.GetSettingInt(truenessCvar);
        this.bits.ground.checked = Boolean(setting & 1 << 0);
        this.bits.projected.checked = Boolean(setting & 1 << 1);
        this.bits.cpmTurn.checked = Boolean(setting & 1 << 2);
    }

    setTruenessMode() {
        const setting = (this.bits.ground.checked ? 1 << 0 : 0)
        | (this.bits.projected.checked ? 1 << 1 : 0)
        | (this.bits.cpmTurn.checked ? 1 << 2 : 0);

        GameInterfaceAPI.SetSettingInt(truenessCvar, setting);
    }
}