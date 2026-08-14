import MessageBubble from "../chat/MessageBubble";

function MessageList({ messages = [] }) {

  return (
    <div className="flex-1 p-4">
      {messages.map((message,index) => (
        <MessageBubble 
            key={index}
            message={message}
          />
      ))}
    </div>
  )
}
export default MessageList; 