import express from "express"
import http from "http"

import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import { ILiveServerActionsServer } from "../types/ILiveServerActions"
import IAdminPanel, { ISessions } from "../types/IAdminPanel"
const app = express()
const server = http.createServer(app)




require("dotenv").config()

let origins: string[] = []

if (process.env.ORIGINS) {
	// if comma, split the env prigins, them them and add them
	let envOrigins: string[] = []
	if (process.env.ORIGINS.indexOf(",") > -1) {
		envOrigins = process.env.ORIGINS.split(",")
		envOrigins.forEach((o) => {
			origins.push(o.trim())
		})
	} else {
		origins.push(process.env.ORIGINS.trim())
	}


	origins = [
		...origins,
		...envOrigins
	]
}

origins.push("https://test.livecase.com")
origins.push("https://www.livecase.com")
origins.push("https://staging.livecase.com")
console.log("ORIGINS:", origins)

const io = new SocketIOServer(server, {
	cors: {
		origin: origins,
		methods: ["GET", "POST"]
	}
})

const adminsRoom = "admins"
const adminCallCatcher = "call"

app.use(express.json())

// app.use((req, res, next) => {
// 	console.log('Request URL:', req.url)
// 	console.log('Request Origin:', req.get('origin'))
// 	next()
// })


// Security
// Configure CORS to allow requests from specific domains

const corsOptions = {
	origin: origins, //"*", // origins,
	methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
}

app.use(cors(corsOptions))

let clientCounter = 0
let sessions: ISessions = {}
let adminCounter = 0
// Map to store sockets associated with shareCodes
const shareCodeSockets = new Map()


const getOnlineCounter = () => {
	let count = 0
	Object.keys(sessions).forEach((key) => {
		count += sessions[key].count || 0
	})
	return count
}


const pingAdmins = (src?: string) => {

	if (adminCounter <= 0) {
		return
	}

	const adminInfo: IAdminPanel = {
		onlineCount: getOnlineCounter(),
		sessions: sessions
	}

	console.log("===> FROM:", src || "", "ROOM:", adminsRoom, "CALL:", adminCallCatcher)
	// The admin room specific is not emiting properly, so we emit to all
	io.to(adminsRoom).emit(adminCallCatcher, {
		"panel": adminInfo
	})
	// io.emit(adminCallCatcher, {
	// 	"panel": adminInfo
	// })
}


// Express route for serving a simple HTML file
app.get("/", (req, res) => {
	res.send("LiveCase socket server is running. It's alive! It's alive!")
})

// app.get("/count", (req, res) => {
// 	res.header("Content-Type", "text/html")
// 	res.sendFile(__dirname + "/livePanel.html")
// })

app.post("/admins", (req, res) => {
	pingAdmins("API admin called")
	res.json({ success: true })
})

app.get("/size", (req, res) => {
	const totalString = JSON.stringify(sessions) + JSON.stringify(shareCodeSockets)
	const sizeInBytes = Buffer.byteLength(totalString, "utf8")
	const sizeInKb = sizeInBytes / 1024
	const sizeInMb = sizeInKb / 1024
	res.json({
		sizeInKb,
		sizeInMb
	})
})

setInterval(function () {
	if (global.gc) {
		global.gc()
	}
}, 1000 * 30)

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




io.on("connection", (socket) => {
	clientCounter++

	socket.on("subscribe/admin", () => {
		socket.join(adminsRoom)
		adminCounter++
		console.log(`Socket ${socket.id} joined room ${adminsRoom}`)
		pingAdmins("subscribe/admin")
	})
	socket.on("unsubscribe/admin", () => {
		socket.leave(adminsRoom)
		if (adminCounter <= 0) adminCounter = 1
		adminCounter--
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
		pingAdmins("subscribe user")

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
			if (sessions[shareCode].count <= 0) {
				delete sessions[shareCode]
			}
		}
		console.log(`Socket ${socket.id} left room ${shareCode}`)
		pingAdmins("unsubscribe user")
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
			if (sessions[shareCode].count <= 0) {
				delete sessions[shareCode]
			}
		}
		console.log(`Socket ${socket.id} disconnected.`)
		pingAdmins("disconnect user")
	})

	socket.on('error', (error) => {
		console.log(`
		======
		Socket ${socket.id} encountered an error: ${error.message}
		======`)
		// Handle the error or disconnect the client if necessary
	})

})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}`)
})
