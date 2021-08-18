import React from 'react';
import { MiniStatCard } from '../MiniStatCard';
import { AreaBarChart } from '../recharts/AreaBarChart';
import { getDummyEmissionData } from '../recharts/dummyEmissionsData';

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

      <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <div className="rounded-lg bg-white overflow-hidden shadow py-6">
            <AreaBarChart data={getDummyEmissionData()} height={224} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <div className="rounded-lg bg-white overflow-hidden shadow">
            <div className="p-6">
              {emissionSummaryStats.map((item) => (
                <MiniStatCard item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
