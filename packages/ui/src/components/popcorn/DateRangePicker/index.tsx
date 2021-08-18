import { CalendarIcon } from '@heroicons/react/outline';
import React from 'react';

const CalenderInput = ({ isStart }) => {
  return (
    <div className="mx-2">
      <label
        htmlFor="account-number"
        className="block text-sm font-medium text-gray-700"
      >
        {isStart ? 'Start' : 'End'}
      </label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type="text"
          name="start"
          id="start"
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
          placeholder="05/05/2021"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <CalendarIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

export const DateRangePicker = () => {
  return (
    <div className="grid justify-items-stretch mr-24">
      <div className="md:flex md:items-center md:justify-between justify-self-end">
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <CalenderInput isStart={true} />
          <CalenderInput isStart={false} />
          <button
            type="button"
            className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
};
