const { Server } = require("socket.io");

let io;

function initializeSocket(httpServer) {

    io = new Server(httpServer, {
        cors: {
            origin: "*"
        }
    });

    io.on("connection", (socket) => {

        console.log(`Client connected: ${socket.id}`);

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
        });

    });

    return io;
}


function broadcastTelemetry(telemetry) {

    if (io) {
        io.emit("telemetry", telemetry);

        console.log("Telemetry broadcasted:", telemetry);
    }

}


module.exports = {
    initializeSocket,
    broadcastTelemetry
};