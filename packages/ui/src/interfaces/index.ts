import { SVGProps } from 'react';

export interface EmissionSummaryStats {
  id: number;
  name: string;
  stat: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  change: string;
  changeType: string;
}

interface HeaderNavigation {
  name: string;
  href: string;
  current: string|boolean;
}

interface UserNavigation {
  name: string;
  href: string;
}

export interface NavBarProps {
  title: string;
  headerNavigation: HeaderNavigation[];
  userNavigation: UserNavigation[];
  user: {
    name: string;
    email: string;
    imageUrl: string;
  };
  logo: string;
  contractProps: {
    open: boolean;
    setOpen: (state:boolean) => void;
    addContract: (contract:string) => void;
  };
}
