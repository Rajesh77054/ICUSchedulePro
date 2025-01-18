import { Chat } from "@/components/scheduler/Chat";

export default function ChatPage() {
  // For now, we'll use a fixed room ID for global chat
  const globalChatRoomId = 1;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Team Chat</h1>
      <Chat roomId={globalChatRoomId} />
    </div>
  );
}