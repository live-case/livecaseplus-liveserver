import express from "express"
import http from "http"
import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import { ILiveServerActionsServer } from "../types/ILiveServerActions"
const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server)
require("dotenv").config()



app.use(express.json())
// Security
// Configure CORS to allow requests from specific domains
const origins: string[] = []
if (process.env.ORIGINS) {
	origins.push(...process.env.ORIGINS.split(","))
}
const corsOptions = {
	origin: "*", // origins,
	methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
}

app.use(cors(corsOptions))

let clientCounter = 0
let sessions: { [shareCode: string]: { count: number, lastUpdate: string } } = {}

// Express route for serving a simple HTML file
app.get("/", (req, res) => {
	res.send("LiveCase socket server is running. It's alive! It's alive!")
})

app.get("/count", (req, res) => {
	res.header("Content-Type", "text/html")
	res.sendFile(__dirname + "/livePanel.html")

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

	res.status(200).send("Event emitted successfully")
})

// Map to store sockets associated with shareCodes
const shareCodeSockets = new Map()

io.on("connection", (socket) => {
	clientCounter++
	io.emit("clientCountUpdated", clientCounter)

	socket.on("subscribe", (shareCode) => {
		// Join the room associated with the shareCode
		socket.join(shareCode)

		// Increment to the sessions counter
		if (!sessions[shareCode]) {
			sessions[shareCode] = { count: 0, lastUpdate: "" }
		}
		sessions[shareCode].count++
		sessions[shareCode].lastUpdate = new Date().toISOString()
		io.to("admin").emit("sessions", sessions)

		// Store the socket in the map
		shareCodeSockets.set(socket.id, shareCode)

		console.log(`Socket ${socket.id} joined room ${shareCode}`)
	})

	socket.on("unsubscribe", () => {
		// Leave the room and remove the socket from the map
		const shareCode = shareCodeSockets.get(socket.id)
		socket.leave(shareCode)
		shareCodeSockets.delete(socket.id)
		clientCounter--
		console.log(`Socket ${socket.id} left room ${shareCode}`)

		// Remove from session and update
		sessions[shareCode].count--
		sessions[shareCode].lastUpdate = new Date().toISOString()
		io.to("admin").emit("sessions", sessions)
	})

	socket.on("disconnect", () => {
		// Decrement the counter when a client disconnects
		clientCounter--
		// Emit the updated counter to all clients
		io.emit("clientCountUpdated", clientCounter)

		// Remove the socket from the map
		const shareCode = shareCodeSockets.get(socket.id)
		shareCodeSockets.delete(socket.id)

		// Remove from session and update
		if (sessions[shareCode]) {
			sessions[shareCode].count--
			sessions[shareCode].lastUpdate = new Date().toISOString()
			io.to("admin").emit("sessions", sessions)
		}
	})

	// socket.on('changeShareCode', (newShareCode) => {
	// 	// Handle shareCode changes here and emit an event to the room
	// 	const oldShareCode = shareCodeSockets.get(socket.id)
	// 	socket.leave(oldShareCode)
	// 	socket.join(newShareCode)
	// 	shareCodeSockets.set(socket.id, newShareCode)

	// 	console.log(`Socket ${socket.id} changed to room ${newShareCode}`)
	// 	io.to(newShareCode).emit('shareCodeChanged', newShareCode)
	// })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}`)
})
