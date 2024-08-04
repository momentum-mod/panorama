/**
 * This API is a pile of crap, using mostly KV1 in C++ and total nightmare to follow.
 * We'll probably rewrite in the future, for now, sorry about the bizarre types!
 */
declare namespace SteamLobby {
	export interface Lobby {
		/** String of uint64 SteamID */
		owner: string;
		/** String of LobbyType value, LobbyType value */
		type: '0' | '1' | '2';
		members: number;
		members_limit: number;
	}

	/*
	 * List of all lobbies
	 */
	export type LobbyList = {
		[Type in 'friends' | 'global' | 'current']?: LobbyData;
	};

	/**
	 * A lobby list for a specific type of global/friends/current
	 */
	export type LobbyData = {
		[steamID: string]: Lobby;
	};

	export type MemberData = {
		[steamID: string]: Member;
	};

	export interface Member {
		map: string;
		/**
		 * Currently a KV1 string which structure of Appearance.]
		 * When needed, tell a C++ programmer - we need to unfuck this code first.
		 */
		appearance: string;
		isTyping: 'y' | undefined;
		isSpectating: '1' | undefined;
		/** Not passed by C++, but used in JS code */
		isMuted: boolean | undefined;
		/** String of uint64 SteamID */
		specTargetID: string; // Might be a string??? idk
	}

	export interface Appearance {
		bodygroup: int32;
		/** RGBA Hex */
		model_color: string;
		/** RGBA Hex */
		trail_color: string;
		trail_length: int32;
		trail_enabled: boolean;
		flashlight_enabled: boolean;
	}
}

declare namespace News {
	interface RSSFeedItem {
		title: string;
		description: string;
		link: string;
		date: string;
		author: string;
		image: string;
	}
}