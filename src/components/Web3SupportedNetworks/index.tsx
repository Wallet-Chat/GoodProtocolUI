import React, { Fragment, useMemo } from 'react'
import { getNetworkEnv } from '@gooddollar/web3sdk'
import { SupportedV2Networks, SupportedV2Network } from '@gooddollar/web3sdk-v2'

export interface IWeb3SupportedNetworkRecord {
    network: string
    chain: number
}

export interface IWeb3SupportedNetworksProps {
    onItem: (item: IWeb3SupportedNetworkRecord) => JSX.Element
}

export default function Web3SupportedNetworks({ onItem }: IWeb3SupportedNetworksProps): JSX.Element | null {
    const network = getNetworkEnv()

    const networks = useMemo(
        () => Object.keys(SupportedV2Networks).filter((v) => isNaN(Number(v))) as SupportedV2Network[],
        []
    )

    if (network === 'production') {
        return null
    }

    return (
        <>
            {networks.map((key) => (
                <Fragment key={key}>{onItem({ network: key, chain: SupportedV2Networks[key] })}</Fragment>
            ))}
        </>
    )
}
