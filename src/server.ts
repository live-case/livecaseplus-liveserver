import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import { ILiveServerActionsServer } from "../types/ILiveServerActions"
import IAdminPanel, { ISessions } from "../types/IAdminPanel"
const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server)
require("dotenv").config()

const adminsRoom = "admins"
const adminCallCatcher = "call"

app.use(express.json())
// Security
// Configure CORS to allow requests from specific domains
const origins: string[] = []
if (process.env.ORIGINS) {
	origins.push(...process.env.ORIGINS.split(","))
}
if (process.env.NODE_ENV !== "production") {
	origins.push("http://localhost:5000")
}
origins.push("https://test.livecase.com.com")
origins.push("https://www.livecase.com.com")
origins.push("https://staging.livecase.com.com")
const corsOptions = {
	origin: origins, //"*", // origins,
	methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
}

app.use(cors(corsOptions))

let clientCounter = 0
let sessions: ISessions = {}

const getOnlineCounter = () => {
	let count = 0
	Object.keys(sessions).forEach((key) => {
		count += sessions[key].count || 0
	})
	return count
}


const pingAdmins = (src?: string) => {
	const adminInfo: IAdminPanel = {
		onlineCount: getOnlineCounter(),
		sessions: sessions
	}
	console.log("===> FROM:", src || "", "ROOM:", adminsRoom, "CALL:", adminCallCatcher)
	// The admin room specific is not emiting properly, so we emit to all
	// io.to(adminsRoom).emit(adminCallCatcher, {
	// 	"panel": adminInfo
	// })
	io.emit(adminCallCatcher, {
		"panel": adminInfo
	})
}


// Express route for serving a simple HTML file
app.get("/", (req, res) => {
	res.send("LiveCase socket server is running. It's alive! It's alive!")
})

app.get("/count", (req, res) => {
	res.header("Content-Type", "text/html")
	res.sendFile(__dirname + "/livePanel.html")
})

app.post("/admins", (req, res) => {
	pingAdmins("API admin called")
	res.json({ success: true })
})

app.post("/listener", (req, res) => {

	const body = req.body as ILiveServerActionsServer
	// Validate the body here
	const secret = process.env.SHARED_SERVER_SECRET_KEY
	if (secret) {
		if (body.secret !== secret) {
			console.log("Unauthorized")
			res.status(401).send("Unauthorized")
			return
		}
		delete body.secret
	}
	if (!body) {
		console.log("Missing body")
		res.status(400).send("Missing body")
		return
	}
	// Emit an event to a specific room
	const shareCode = body.shareCode
	if (!shareCode) {
		console.log("Missing shareCode")
		res.status(400).send("Missing shareCode")
		return
	}
	console.log(`Emitting event ${body.type} to room ${shareCode} data: ${JSON.stringify(body)}`)


	io.to(shareCode).emit(body.context, body)


	if (!sessions[shareCode]) {
		sessions[shareCode] = { count: 0 }
	}
	sessions[shareCode].lastUpdate = new Date().toISOString()

	pingAdmins("API listener called")

	res.status(200).send("Event emitted successfully")
})


// Map to store sockets associated with shareCodes
const shareCodeSockets = new Map()

io.on("connection", (socket) => {
	clientCounter++

	socket.on("subscribe/admin", () => {
		socket.join(adminsRoom)
		console.log(`Socket ${socket.id} joined room ${adminsRoom}`)
		pingAdmins("subscribe/admin")
	})
	socket.on("unsubscribe/admin", () => {
		socket.leave(adminsRoom)
		console.log(`Socket ${socket.id} left room ${adminsRoom}`)
	})

	socket.on("subscribe", (shareCode) => {
		// Join the room associated with the shareCode
		socket.join(shareCode)

		// Increment to the sessions counter
		if (!sessions[shareCode]) {
			sessions[shareCode] = { count: 0 }
		}
		sessions[shareCode].count++
		sessions[shareCode].lastUpdate = new Date().toISOString()

		// Store the socket in the map
		shareCodeSockets.set(socket.id, shareCode)


		console.log(`Socket ${socket.id} joined room ${shareCode}`)
		pingAdmins("subscribe")

	})

	socket.on("unsubscribe", () => {
		// Leave the room and remove the socket from the map
		const shareCode = shareCodeSockets.get(socket.id)
		socket.leave(shareCode)
		shareCodeSockets.delete(socket.id)

		// Remove from session and update
		if (shareCode && sessions[shareCode]) {
			sessions[shareCode].count--
			sessions[shareCode].lastUpdate = new Date().toISOString()
		}
		console.log(`Socket ${socket.id} left room ${shareCode}`)
		pingAdmins("unsubscribe")
	})

	socket.on("disconnect", () => {
		// Decrement the counter when a client disconnects
		clientCounter--

		// Remove the socket from the map
		const shareCode = shareCodeSockets.get(socket.id)
		shareCodeSockets.delete(socket.id)

		// Remove from session and update
		if (shareCode && sessions[shareCode]) {
			sessions[shareCode].count--
			sessions[shareCode].lastUpdate = new Date().toISOString()
		}
		console.log(`Socket ${socket.id} disconnected.`)
		pingAdmins("disconnect")
	})

})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}`)
})
