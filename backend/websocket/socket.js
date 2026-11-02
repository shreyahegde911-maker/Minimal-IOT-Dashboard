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

function closeSocket(callback) {
    if (io) {
        io.close(callback);
    } else if (callback) {
        callback();
    }
}

module.exports = {
    initializeSocket,
    broadcastTelemetry,
    closeSocket
};