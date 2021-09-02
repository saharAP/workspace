import React from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/outline';
import ReactTooltip from 'react-tooltip';

export interface TooltipProps {
  title: string;
  content: string | React.ReactElement;
  id?: string;
  place?: "bottom" | "left" | "right" | "top";
  size?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ title, content, place, id, size }) => {
  size = size || 4;
  id = id || "tooltip-" + (new Date().getTime());

  return (
    <div className="">
      <QuestionMarkCircleIcon
        data-tip
        data-for={id}
        className={`cursor-pointer h-${size} w-${size}`}
      />
      <ReactTooltip
        id={id}
        place={place || "bottom"}
        effect="solid"
        type="light"
        className="shadow-lg border border-gray-50 p-1 w-60"
      >
        <p className="font-bold text-center">{title}</p>
        <p className="text-center text-gray-600">{content}</p>
      </ReactTooltip>
    </div>
  );
}
export default Tooltip;