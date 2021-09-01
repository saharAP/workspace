import {
  BeneficiaryApplication,
  GrantElectionAdapter,
} from '@popcorn/contracts/adapters';
import Link from 'next/link';
import truncate from 'utils/truncate';
import { ElectionProps } from './ElectionProps';
import GrantFunded from './GrantFunded';
import VoteSlider from './VoteSlider';
interface BeneficiaryCardWithElectionDataProps {
  beneficiary: BeneficiaryApplication;
  electionProps: ElectionProps;
}

const BeneficiaryCardWithElectionData: React.FC<BeneficiaryCardWithElectionDataProps> =
  ({ electionProps, beneficiary }) => {
    return (
      <div className="shadow-sm w-80 h-auto rounded-lg mr-8 mb-16 bg-white border-b border-gray-200 ">
        <Link
          href={`/beneficiaries/${beneficiary?.beneficiaryAddress}`}
          passHref
        >
          <a>
            <div className="w-full h-32 rounded-t-lg">
              <img
                className="w-100 h-auto md:w-100 md:h-auto md:rounded-t rounded-t mx-auto"
                src={`${process.env.IPFS_URL}${beneficiary?.files?.profileImage?.image}`}
                alt=""
                style={{ objectFit: 'cover', height: '140px' }}
              ></img>
            </div>
          </a>
        </Link>
        <div className="w-full px-4 pb-6 pt-6">
          <div className="h-10 mt-3">
            <Link
              href={`/beneficiaries/${beneficiary?.beneficiaryAddress}`}
              passHref
            >
              <a>
                <h3 className="text-lg font-bold text-gray-800 leading-snug">
                  {beneficiary?.organizationName}
                </h3>
              </a>
            </Link>
          </div>
          <div className="h-32">
            <Link
              href={`/beneficiaries/${beneficiary?.beneficiaryAddress}`}
              passHref
            >
              <a>
                <p className="text-sm text-gray-700">
                  {truncate(beneficiary?.missionStatement, 180)}
                </p>
              </a>
            </Link>
          </div>
          <div className="">
            {GrantElectionAdapter().isActive(electionProps.election) ? (
              <VoteSlider
                electionProps={electionProps}
                beneficiary={beneficiary}
              />
            ) : (
              <GrantFunded
                electionProps={electionProps}
                beneficiary={beneficiary}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

export default BeneficiaryCardWithElectionData;
