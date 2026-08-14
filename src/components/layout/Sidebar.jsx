import AppLogo from "../layout/AppLogo";
import NewChatButton from "../layout/NewChatButton";
import SearchChat from "../layout/SearchChat";
import ChatList from "../layout/ChatList";
import ThemeToggle from "../layout/ThemeToggle";



function Sidebar () {

  return (
    <div className="w-[280px] border-r flex flex-col gap-4 p-4">
      <AppLogo />
      <NewChatButton />
      <SearchChat />
      <ChatList />
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </div>
  )
}

export default Sidebar;