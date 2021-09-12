import { XCircleIcon } from '@heroicons/react/solid';
import React from 'react';

interface FormStepProps {
  incompleteFields: string[];
}

export const DisplayIncompleteFormInputs: React.FC<FormStepProps> = ({
  incompleteFields,
}) => {
  return (
    <div className="rounded-md bg-red-50 p-4 my-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Unable to submit form as the following mandatory fields are missing
            from your submission:
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul role="list" className="list-disc pl-5 space-y-1">
              {incompleteFields.map((incompleteField) => {
                return <li>{incompleteField}</li>;
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
