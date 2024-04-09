
export type ILiveServerActionRewind = {
	context: "session",
	shareCode: string,
	type: "rewind",
	data: {
		playId: string
	}
}

export type ILiveServerActionHostUpdate = {
	context: "session",
	shareCode: string,
	type: "hostUpdate"
}

export type ILiveServerActionNewPlayer = {
	context: "session",
	shareCode: string,
	type: "newPlayer"
}

export type ILiveServerActionPlayerFinishedEpisode = {
	context: "session",
	shareCode: string,
	type: "playerFinishedEpisode"
}

export type ILiveServerActionMessage = {
	context: "session",
	shareCode: string,
	type: "message",
	data: {
		type?: "error" | "success" | "info",
		timeout?: number,
		message: string,
		id: string
	}
}

export type ILiveServerActionPlayerAiFeedback = {
	context: "session",
	shareCode: string,
	type: "playerAiFeedback",
	data: {
		playId: string,
		chatId: string,
		aiFeedback?: string,
		grade?: number
	}
}

type ILiveServerActions = ILiveServerActionRewind | ILiveServerActionHostUpdate | ILiveServerActionNewPlayer | ILiveServerActionMessage | ILiveServerActionPlayerFinishedEpisode
	| ILiveServerActionPlayerAiFeedback
export default ILiveServerActions

export type ILiveServerActionsServer = ILiveServerActions & {
	secret?: string
}

export type ILiveServerActionsServerEvent = ILiveServerActionsServer & {
	createdAt: string
}
