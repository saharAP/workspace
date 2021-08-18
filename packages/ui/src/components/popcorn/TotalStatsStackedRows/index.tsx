import {
  CursorClickIcon,
  MailOpenIcon,
  UsersIcon,
} from '@heroicons/react/solid';
import React from 'react';
import { AreaBarChart } from '../recharts/AreaBarChart';
import { getDummyEmissionData } from '../recharts/dummyEmissionsData';
import { StatsRow } from '../StatsRow/index';

const stats = [
  {
    id: 1,
    name: 'CO2 Emissions (kg)',
    stat: '71,897',
    icon: UsersIcon,
    change: '122',
    changeType: 'increase',
  },
  {
    id: 2,
    name: 'Transactions',
    stat: '58.16%',
    icon: MailOpenIcon,
    change: '5.4%',
    changeType: 'increase',
  },
  {
    id: 3,
    name: 'Average Gas Price',
    stat: '24.57%',
    icon: CursorClickIcon,
    change: '3.2%',
    changeType: 'decrease',
  },
];

export const TotalStatsStackedRows = ({ emissionSummaryStats }) => {
  return (
    <div className="py-10 mx-8">
      <div className="max-w-7xl">
        <div className="mt-2 mb-8">
          <dt>
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Total Stats
            </h1>
          </dt>
          <dd className=" text-base text-gray-500">
            19 Aug 2021 - 09:12 (UTC)
          </dd>
        </div>
      </div>

      <div className="max-w-7xl">
        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <div className="rounded-lg bg-white overflow-hidden shadow py-6">
            <AreaBarChart data={getDummyEmissionData()} height={224} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl">
        <StatsRow stats={stats} />
      </div>
    </div>
  );
};
