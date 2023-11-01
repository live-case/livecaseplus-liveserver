interface ISessionItem { count: number, lastUpdate?: string }

export interface ISessions {
	[shareCode: string]: ISessionItem
}
export default interface IAdminPanel {
	onlineCount: number
	sessions: ISessions
}

export interface IAdminPings {
	"panel": IAdminPanel
}
