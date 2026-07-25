import { io } from "socket.io-client";

// Create the connection
export const socket = io("http://localhost:5000");

// When connected
socket.on("connect", () => {
    console.log("Connected:", socket.id);

    // Send a message to the server
    socket.emit("hello", "Hello Server!");
});

socket.on("welcome", (message) => {
    console.log(message);
});