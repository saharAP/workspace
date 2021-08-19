import { PlusIcon as PlusIconOutline } from '@heroicons/react/outline';

export const AddContractButton = () => {
  return (
    <div className="flex items-center">
      <div className="mx-auto flex flex-row">
        <button
          type="button"
          className="mr-4 items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIconOutline className="h-8 w-8" aria-hidden="true" />
        </button>
        <p className="my-auto text-xl text-gray-900">Add Contract</p>
      </div>
    </div>
  );
};
