"use strict";
var Speedo;
(function (Speedo) {
    let SpeedometerTypes;
    (function (SpeedometerTypes) {
        SpeedometerTypes[SpeedometerTypes["OVERALL_VELOCITY"] = 0] = "OVERALL_VELOCITY";
        SpeedometerTypes[SpeedometerTypes["EXPLOSION_VELOCITY"] = 1] = "EXPLOSION_VELOCITY";
        SpeedometerTypes[SpeedometerTypes["JUMP_VELOCITY"] = 2] = "JUMP_VELOCITY";
        SpeedometerTypes[SpeedometerTypes["RAMP_VELOCITY"] = 3] = "RAMP_VELOCITY";
        SpeedometerTypes[SpeedometerTypes["ZONE_VELOCITY"] = 4] = "ZONE_VELOCITY";
    })(SpeedometerTypes = Speedo.SpeedometerTypes || (Speedo.SpeedometerTypes = {}));
    let SpeedometerDataKeys;
    (function (SpeedometerDataKeys) {
        SpeedometerDataKeys["CUSTOM_LABEL"] = "custom_label";
        SpeedometerDataKeys["TYPE"] = "type";
        SpeedometerDataKeys["ENABLED_AXES"] = "enabled_axes";
        SpeedometerDataKeys["COLOR_TYPE"] = "color_type";
        SpeedometerDataKeys["RANGE_COL_PROF"] = "range_color_profile";
    })(SpeedometerDataKeys = Speedo.SpeedometerDataKeys || (Speedo.SpeedometerDataKeys = {}));
    let RangeColorProfileKeys;
    (function (RangeColorProfileKeys) {
        RangeColorProfileKeys["PROFILE_NAME"] = "profile_name";
        RangeColorProfileKeys["PROFILE_RANGE_DATA"] = "profile_ranges";
    })(RangeColorProfileKeys = Speedo.RangeColorProfileKeys || (Speedo.RangeColorProfileKeys = {}));
    let SpeedometerColorTypes;
    (function (SpeedometerColorTypes) {
        SpeedometerColorTypes[SpeedometerColorTypes["NONE"] = 0] = "NONE";
        SpeedometerColorTypes[SpeedometerColorTypes["RANGE"] = 1] = "RANGE";
        SpeedometerColorTypes[SpeedometerColorTypes["COMPARISON"] = 2] = "COMPARISON";
        SpeedometerColorTypes[SpeedometerColorTypes["COMPARISON_SEP"] = 3] = "COMPARISON_SEP";
    })(SpeedometerColorTypes = Speedo.SpeedometerColorTypes || (Speedo.SpeedometerColorTypes = {}));
    Speedo.SpeedometerDispNames = new Map([
        [SpeedometerTypes.OVERALL_VELOCITY, '#Speedometer_Type_OverallVelocity'],
        [SpeedometerTypes.EXPLOSION_VELOCITY, '#Speedometer_Type_ExplosiveJump'],
        [SpeedometerTypes.JUMP_VELOCITY, '#Speedometer_Type_Jump'],
        [SpeedometerTypes.RAMP_VELOCITY, '#Speedometer_Type_Ramp'],
        [SpeedometerTypes.ZONE_VELOCITY, '#Speedometer_Type_Zone']
    ]);
})(Speedo || (Speedo = {}));
