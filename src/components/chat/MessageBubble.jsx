function MessageBubble({ message }) {

  const isUser = message.role === "user";

  return (
    <div
      className={`my-2 flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`rounded-lg px-4 py-2 max-w-md ${
          isUser
            ? "bg-black text-white"
            : "bg-gray-200 text-black"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export default MessageBubble;