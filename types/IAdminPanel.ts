import { ILiveServerActionsServer } from "./ILiveServerActions"

interface ISessionItem { count: number, lastUpdate?: string }

export interface ISessions {
	[shareCode: string]: ISessionItem
}
export default interface IAdminPanel {
	onlineCount: number
	sessions: ISessions
	events: ILiveServerActionsServer[]
}

export interface IAdminPings {
	"panel": IAdminPanel
}
