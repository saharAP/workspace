import { Web3Provider } from '@ethersproject/providers';
import {
  IpfsClient,
} from '@popcorn/utils';
import {
  BeneficiaryGovernanceAdapter, Proposal, ProposalStatus
} from "@popcorn/contracts/adapters";
import { useWeb3React } from '@web3-react/core';
import BeneficiaryInformation from 'components/CommonComponents/BeneficiaryInformation';
import ImageHeader from 'components/CommonComponents/ImageHeader';
import Loading from 'components/CommonComponents/Loading';
import PhotoSideBar from 'components/CommonComponents/PhotoSideBar';
import VideoSideBar from 'components/CommonComponents/VideoSideBar';
import NavBar from 'components/NavBar/NavBar';
import { ContractsContext } from 'context/Web3/contracts';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import Voting from './Voting/Voting';

const getTitle = (proposal: Proposal): string => {
  return `${ProposalStatus[proposal.status]} vote on ${proposal?.application?.organizationName
    }`;
};

const ProposalPage: React.FC = () => {
  const { contracts } = useContext(ContractsContext);
  const { account } = useWeb3React<Web3Provider>();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal>();
  const [proposalId, setProposalId] = useState<number>();
  const [hasVoted, setHasVoted] = useState<boolean>(false);

  useEffect(() => {
    const { id } = router.query;
    if (id && +id !== proposalId) setProposalId(+id);
  }, [router, proposalId]);

  useEffect(() => {
    if (contracts?.beneficiaryGovernance && proposalId) {
      new BeneficiaryGovernanceAdapter(contracts.beneficiaryGovernance, IpfsClient)
        .getProposal(proposalId)
        .then((res) => setProposal(res));
    }
  }, [contracts, proposalId]);

  useEffect(() => {
    if (contracts?.beneficiaryGovernance && proposal && account) {
      new BeneficiaryGovernanceAdapter(contracts.beneficiaryGovernance, IpfsClient)
        .hasVoted(proposalId, account)
        .then((res) => setHasVoted(res));
    }
  }, [contracts, account, proposal]);

  function getContent() {
    return proposalId &&
      proposal &&
      Object.keys(proposal).length > 0 ? (
      <React.Fragment>
        <ImageHeader
          beneficiary={proposal?.application}
          title={getTitle(proposal)}
        />
        <Voting proposal={proposal} hasVoted={hasVoted} />
        <div className="grid grid-cols-8 gap-4 space-x-12 mx-auto px-8">
          <div className="col-span-2 space-y-4">
            <VideoSideBar beneficiary={proposal?.application} />
            <PhotoSideBar beneficiary={proposal?.application} />
          </div>
          <BeneficiaryInformation
            beneficiary={proposal?.application}
            isProposalPreview={false}
          />
        </div>
      </React.Fragment>
    ) : (
      <Loading />
    );
  }
  return (
    <div className="flex flex-col h-full w-full pb-16 ">
      <NavBar />
      {getContent()}
    </div>
  );
};
export default ProposalPage;
