
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

type ILiveServerActions = ILiveServerActionRewind | ILiveServerActionHostUpdate | ILiveServerActionNewPlayer
export default ILiveServerActions

export type ILiveServerActionsServer = ILiveServerActions & {
	secret?: string
}
