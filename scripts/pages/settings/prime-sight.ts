import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { TruenessMode } from 'hud/cgaz';

const truenessCvar = 'mom_hud_df_prime_trueness_mode';

@PanelHandler()
class PrimeSightSettingsHandler implements OnPanelLoad {
    readonly primeSightSettings = $('#PrimeSightSettings');
    readonly bits = {
		ground: $<ToggleButton>('#GroundTrueness')!,
		projected: $<ToggleButton>('#ProjectedTrueness')!,
		cpmTurn: $<ToggleButton>('#CPMTurnTrueness')!
	};

	constructor() {
		$.RegisterConVarChangeListener(truenessCvar, () => this.setCheckboxState());
	}

	onPanelLoad() {
		this.setCheckboxState();
	}

    setCheckboxState() {
        const setting = GameInterfaceAPI.GetSettingInt(truenessCvar);
        //this.bits.ground.checked = Boolean(setting & TruenessMode.GROUND);
        //this.bits.projected.checked = Boolean(setting & TruenessMode.PROJECTED);
        //this.bits.cpmTurn.checked = Boolean(setting & TruenessMode.CPM_TURN);
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