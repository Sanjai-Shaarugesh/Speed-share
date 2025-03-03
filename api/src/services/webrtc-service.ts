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

export function setupWebRTCSignaling(server: Server){
  const io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'https://localhost:3000',
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket)=>{
    let userId: string;
    
    socket.on('register' , async(data)=>{
      userId = data.userId;
      
      // Store the connection 
      peerConnections.set(socket.id, {
        socket,
        userId
      });
      
      console.log(`User ${userId} connected with the socket ${socket.id}`);
      
      //Acknowledge the register 
      socket.emit('registered', { id: socket.id });
    })
  })
}
