import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { redisClient , connectRedis } from '../utils/redis';

type PeerConnection = {
  socket: any;
  userId: string;
  fileId?: string;
  transferInProgress?: boolean;
  
};

// store peer connection in memory
const peerConnections = new Map<string, PeerConnection>();

// setup redis pub/sub for load balancing in a distribunting enivironment
let redisPubClient: any;
let redisSubClient: any;

const REDIS_CHANNEL = 'webrtc-signaling';

export async function setupRedisSignaling() {
  if(!redisClient){
    await connectRedis();
  }

  redisPubClient = redisClient.duplicate();
  redisSubClient = redisClient.duplicate();

  await redisPubClient.connect();
  await redisSubClient.connect();

  await redisSubClient.subscribe(REDIS_CHANNEL, (message: string) => {
    try {
      const data = JSON.parse(message);
      handleRedisMessage(data);
    }
    catch (error) {
      console.error(`Error processing message: ${error}`);
    }
  });

  function handleRedisMessage(data:any){
    const { type, targetId, payload } = data;

    const targetPeer = peerConnections.get(targetId);
    if(targetPeer){
      targetPeer.socket.emit(type, payload);

    }
  }

  // Mark as unused until implementation complete
  function publishToRedis(type:string,targetId:string,payload:any){
    const message = JSON.stringify({
      type,
      targetId,
      payload
    });

    return redisPubClient.publish(REDIS_CHANNEL, message);
  }

  // Moved outside of setupRedisSignaling
  return {
    publishToRedis,
    handleRedisMessage
  };
}

export async function setupWebRTCSignaling(server: Server){
  const io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'https://localhost:3000',
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  const redisSignaling = await setupRedisSignaling();

  io.on('connection', (socket) => {
    let userId: string;

    socket.on('register', async (data) => {
      userId = data.userId;

      // Store the connection 
      peerConnections.set(socket.id, {
        socket,
        userId
      });

      console.log(`User ${userId} connected with the socket ${socket.id}`);

      //Acknowledge the register 
      socket.emit('registered', { id: socket.id });
    });

    // Handle initating file transfer
    socket.on('intiate-transfer', async (data) => {
      const { fileId, targetUserId } = data;

      //update peer file id
      const peer = peerConnections.get(socket.id);
      if (peer) {
        peer.fileId = fileId;
      }

      //Find the target user's socket

      const targetSocket = Array.from(peerConnections.entries())
        .filter(([_, peer]) => peer.userId === targetUserId)
        .map(([id, _]) => id);

      // notify the sender about available target 
      socket.emit('transfer-targets', { fileId, targets: targetSocket });
    });

    // webRTC signaling 
    socket.on("offer", async (data) => {
      const { targetId, sdp } = data;

      // use redis pub/sub signling
      await redisSignaling.publishToRedis("offer", targetId, {
        from: socket.id,
        sdp
      })
    });
    
    socket.on('answer', async (data) => {
      const { targetId, sdp } = data;
      
      await redisSignaling.publishToRedis('answer', targetId, {
        from: socket.id,
        sdp
      });
    });
    
    socket.on('ice-candiate', async (data) => {
      const { targetId, candiate } = data;
      
      await redisSignaling.publishToRedis('candiate', targetId, {
        from: socket.id,
        candiate
      });
    });
    
    // Transfer the update
    socket.on('transfer-started', (data) => {
      const { targetId, fileId } = data;
      
      const peer = peerConnections.get(socket.id);
      
      if (peer) {
        peer.transferInProgress = true;
      }
      
      redisSignaling.publishToRedis('transfer-started', targetId, {
        from: socket.id,
        fileId
      });
      
    });
    
    socket.on('transfer-progress', (data: any) => {
      const { targetId, fileId, progress } = data;
      
      redisSignaling.publishToRedis('transfer-progress', targetId, {
        from: socket.id,
        fileId,
        progress
      });
    });
    
    socket.on('transfer-complete', (data) => {
      const { targetId, fileId } = data;
      
      const peer = peerConnections.get(socket.id);
      
      if (peer) {
        peer.transferInProgress = false;
      }
      
      redisSignaling.publishToRedis('transfer-complete', targetId, {
        from: socket.id,
        fileId
      });
    });
    
    socket.on('transfer-error', (data) => {
      const { targetId, fileId, error } = data;
      
      const peer = peerConnections.get(socket.id);
      
      if (peer) {
        peer.transferInProgress = false;
      }
      
      redisSignaling.publishToRedis('transfer-error', targetId, {
        from: socket.id,
        fileId,
        error
      });
      
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      peerConnections.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Notify peer who are in active transfer with this socket 
      Array.from(peerConnections.values())
        .filter(peer => peer.transferInProgress)
        .forEach(peer => {
          peer.socket.emit('peer-disconnected', { peerId: socket.id });
        });
    });
  });
  
  return io;
}
