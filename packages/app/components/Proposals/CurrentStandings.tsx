import Divider from 'components/CommonComponents/Divider';
import ProgressBar from 'components/ProgressBar';
import { Proposal } from '@popcorn/contracts/adapters';

const CurrentStandings: React.FC<Proposal> = (proposal) => {
  return (
    <div className="content-center mx-48">
      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between">
          <p className="text-xl font-semibold text-gray-900">
            Current Standings
          </p>
        </span>
      </div>
      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between">
          <p className="text-lg font-medium text-gray-700">Votes For</p>
          <span className="text-base text-gray-700 flex flex-row">
            <p>{proposal?.votes?.for}</p>
          </span>
        </span>
      </div>

      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between  pb-2">
          <ProgressBar
            progress={
              +proposal?.votes?.for === 0
                ? 0
                : (100 * +proposal?.votes?.for) /
                +proposal?.votes?.for + +proposal?.votes?.against
            }
            progressColor={'bg-green-300'}
          />
        </span>
      </div>
      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between">
          <p className="text-lg font-medium text-gray-700">Votes Against</p>
          <span className="text-base text-gray-700 flex flex-row">
            <p>{proposal?.votes?.against}</p>
          </span>
        </span>
      </div>

      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between border-b-2 pb-2">
          <ProgressBar
            progress={
              +proposal?.votes?.against === 0
                ? 0
                : (100 * +proposal?.votes?.against) /

                +proposal?.votes?.for + +proposal?.votes?.against

            }
            progressColor={'bg-red-400'}
          />
        </span>
      </div>

      <div className="grid my-2 justify-items-stretch">
        <span className="mx-4  w-1/2 justify-self-center flex flex-row justify-between">
          <p className="text-lg font-medium text-gray-700">Total Votes</p>
          <span className="text-base text-gray-700 flex flex-row">
            <p>
              {
                +proposal?.votes?.for + +proposal?.votes?.against
              }
            </p>
          </span>
        </span>
      </div>
      <Divider />
    </div>
  );
};
export default CurrentStandings;
