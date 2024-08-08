namespace SteamLobby {
	export enum LobbyType {
		PRIVATE = 0,
		FRIENDS = 1,
		PUBLIC = 2
	}

	// TODO: All of left/disconnected/kicked/banned are lumped into LEAVE here in C++, could distinguish.
	export enum MemberStateChange {
		JOIN = 'join',
		LEAVE = 'leave'
	}

	// TODO: Localise `name`!
	export const LobbyProperties: ReadonlyMap<LobbyType, { name: string; icon: string }> = new Map([
		[LobbyType.PRIVATE, { name: 'Private Lobby', icon: 'privatelobby' }],
		[LobbyType.FRIENDS, { name: 'Friends Only Lobby', icon: 'friendslobby' }],
		[LobbyType.PUBLIC, { name: 'Public Lobby', icon: 'publiclobby' }]
	]);
}
