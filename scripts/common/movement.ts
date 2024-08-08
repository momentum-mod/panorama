namespace Movement {
	export enum PlayerMoveStatus {
		AIR = 0,
		WALK = 1,
		WATER = 2,
		WATERJUMP = 3
	}

	export enum MoveType {
		NONE = 0,
		ISOMETRIC = 1,
		WALK = 2,
		STEP = 3,
		FLY = 4,
		FLYGRAVITY = 5,
		VPHYSICS = 6,
		PUSH = 7,
		NOCLIP = 8,
		LADDER = 9,
		OBSERVER = 10,
		CUSTOM = 11
	}

	export enum DefragPhysics {
		VQ3 = 0,
		CPM = 1,
		VTG = 2
	}
}
