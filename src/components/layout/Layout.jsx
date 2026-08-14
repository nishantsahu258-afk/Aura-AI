import Sidebar from './Sidebar';
import ChatWindow from '../chat/ChatWindow';

function Layout(){
  return (
    <div className="flex h-screen">
      <Sidebar />
      <ChatWindow />
    </div>
  )
}

export default Layout;