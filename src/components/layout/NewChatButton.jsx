import { FiPlus as PlusIcon } from "react-icons/fi";

function NewChatButton(){
    return (
      <button className="w-full flex px-4 py-2 rounded-lg bg-black text-white">
       <PlusIcon className='w-5 h-5 mr-2' /> New Chat
      </button>
    )
}

export default NewChatButton;