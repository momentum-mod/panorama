export interface Lobby {
	owner: steamID;

	type: LobbyType;

	members: number;

	members_limit: number;

	is_map_lobby: boolean;
}

/* List of all lobbies grouped by currrent/friends/global */
export type GroupedLobbyLists = Partial<Record<'friends' | 'global' | 'current', LobbyList>>;

/** A lobby list for a specific type of global/friends/current */
export type LobbyList = Record<uint64_str, Lobby>;

export type MemberData = Record<steamID, LobbyMember>;

export interface LobbyMember {
	map_name: string;

	isTyping: 'y' | undefined;

	isSpectating: '1' | undefined;

	/** Not passed by C++, but used in JS code */
	isMuted: boolean | undefined;

	specTargetID: steamID;
}

// TODO: All of left/disconnected/kicked/banned are lumped into LEAVE here in C++, could distinguish if needed.
export enum LobbyMemberStateChange {
	JOIN = 'join',
	LEAVE = 'leave'
}

// Strings because the C++ api is dumb
export enum LobbyType {
	PRIVATE = '0',
	FRIENDS = '1',
	PUBLIC = '2',
	INVISIBLE = '3'
}

// TODO: Localise `name`!
export const LobbyProperties: ReadonlyMap<LobbyType, { name: string; icon: string }> = new Map([
	[LobbyType.PRIVATE, { name: '#Lobby_Type_Private', icon: 'privatelobby' }],
	[LobbyType.FRIENDS, { name: '#Lobby_Type_FriendsOnly', icon: 'friendsonlylobby' }],
	[LobbyType.PUBLIC, { name: '#Lobby_Type_Public', icon: 'publiclobby' }],
	[LobbyType.INVISIBLE, { name: '#Lobby_Type_MapLobby', icon: 'maplobby' }]
]);
