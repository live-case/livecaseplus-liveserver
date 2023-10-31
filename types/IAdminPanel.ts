export interface ISessions {
	[shareCode: string]: { count: number, lastUpdate?: string }
}
export default interface IAdminPanel {
	onlineCount: number
	sessions: ISessions
}

export interface IAdminPings {
	"panel": IAdminPanel
}
