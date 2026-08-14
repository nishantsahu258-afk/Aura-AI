
import Header from "./Header";
import MessageList from "./MessageList";
import InputBox from "./InputBox";
import TypingLoader from "./TypingLoader";

function ChatWindow() {

  const messages = [
    {
      role: "user",
      content: "Hello AI"
    },
    {
      role: "assistant",
      content: "Hello Human"
    }
  ];
  return (
    <div className="flex flex-col flex-1 ">
       <Header />
      <MessageList messages={messages} />
      <InputBox />
      <TypingLoader />
    </div>
  )
}

export default ChatWindow;