import React, { useCallback, useContext } from 'react'
import { ExternalLink as LinkIcon } from 'react-feather'
import { useDispatch } from 'react-redux'
import styled, { ThemeContext } from 'styled-components'
import CoinbaseWalletIcon from '../../assets/images/coinbaseWalletIcon.svg'
import FortmaticIcon from '../../assets/images/fortmaticIcon.png'
import PortisIcon from '../../assets/images/portisIcon.png'
import TorusIcon from '../../assets/images/torusIcon.png'
import WalletConnectIcon from '../../assets/images/walletConnectIcon.svg'
import { ReactComponent as Close } from '../../assets/images/x.svg'
import { fortmatic, injected, portis, torus, walletconnect, walletlink } from '../../connectors'
import { SUPPORTED_WALLETS } from '../../constants'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { AppDispatch } from '../../state'
import { clearAllTransactions } from '../../state/transactions/actions'
import { ExternalLink, LinkStyledButton, TYPE } from '../../theme'
import { getExplorerLink, shortenAddress } from '../../utils'
import { ButtonSecondary } from '../ButtonLegacy'
import Identicon from '../Identicon'
import { AutoRow } from '../Row'
import Copy from './Copy'
import Transaction from './Transaction'
import Title from '../gd/Title'
import { ButtonOutlined } from '../gd/Button'

const HeaderRow = styled.div`
    ${({ theme }) => theme.flexRowNoWrap};
    padding: 1rem 1rem;
    font-weight: 500;
    color: ${props => (props.color === 'blue' ? ({ theme }) => theme.primary1 : 'inherit')};
    ${({ theme }) => theme.mediaWidth.upToMedium`
    padding: 1rem;
  `};
`

const UpperSection = styled.div`
    position: relative;

    h5 {
        margin: 0;
        margin-bottom: 0.5rem;
        font-size: 1rem;
        font-weight: 400;
    }

    h5:last-child {
        margin-bottom: 0px;
    }

    h4 {
        margin-top: 0;
        font-weight: 500;
    }
`

const InfoCard = styled.div`
    // padding: 1rem;
    // border: 1px solid ${({ theme }) => theme.bg3};
    // border-radius: 10px;
    position: relative;
    display: grid;
    margin-bottom: 20px;
`

const AccountGroupingRow = styled.div`
    ${({ theme }) => theme.flexRowNoWrap};
    justify-content: space-between;
    align-items: center;

    font-style: normal;
    font-weight: 500;
    font-size: 16px;
    line-height: 19px;
    color: ${({ theme }) => theme.color.text1};

    div {
        ${({ theme }) => theme.flexRowNoWrap}
        align-items: center;
    }
`

const AccountSection = styled.div`
    // background-color: ${({ theme }) => theme.bg1};
    padding: 0rem 1rem;
    ${({ theme }) => theme.mediaWidth.upToMedium`padding: 0rem 1rem 1.5rem 1rem;`};
`

const YourAccount = styled.div`
    h5 {
        margin: 0 0 1rem 0;
        font-weight: 400;
    }

    h4 {
        margin: 0;
        font-weight: 500;
    }
`

const LowerSection = styled.div`
    ${({ theme }) => theme.flexColumnNoWrap}
    padding: 1.5rem;
    flex-grow: 1;
    overflow: auto;
    // background-color: ${({ theme }) => theme.bg2};
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;

    font-style: normal;
    font-weight: 500;
    font-size: 16px;
    line-height: 19px;
    color: ${({ theme }) => theme.color.text1};

    h5 {
        margin: 0;
        font-weight: 400;
        color: ${({ theme }) => theme.text3};
    }
`

const AccountControl = styled.div`
    display: flex;
    justify-content: space-between;
    min-width: 0;
    width: 100%;

    font-style: normal;
    font-weight: normal;
    font-size: 24px;
    line-height: 28px;
    color: ${({ theme }) => theme.color.text7};

    a:hover {
        text-decoration: underline;
    }

    p {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`

const AddressLink = styled(ExternalLink)<{ hasENS: boolean; isENS: boolean }>`
    margin-left: 1rem;
    display: flex;

    font-style: normal;
    font-weight: 500;
    font-size: 16px;
    line-height: 19px;
    text-decoration-line: underline;
    color: ${({ theme }) => theme.color.text2};
`

const CloseIcon = styled.div`
    position: absolute;
    right: 0;
    top: 0;
    &:hover {
        cursor: pointer;
        opacity: 0.6;
    }
`

const CloseColor = styled(Close)`
    path {
        fill: ${({ theme }) => theme.color.text8};
    }
`

const WalletName = styled.div`
    width: initial;
    font-size: 0.825rem;
    font-weight: 500;
    color: ${({ theme }) => theme.text3};
`

const IconWrapper = styled.div<{ size?: number }>`
    ${({ theme }) => theme.flexColumnNoWrap};
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    & > img,
    span {
        height: ${({ size }) => (size ? size + 'px' : '32px')};
        width: ${({ size }) => (size ? size + 'px' : '32px')};
    }
    ${({ theme }) => theme.mediaWidth.upToMedium`
    align-items: flex-end;
  `};
`

const TransactionListWrapper = styled.div`
    ${({ theme }) => theme.flexColumnNoWrap};
`

const WalletAction = styled(ButtonOutlined)``

const MainWalletAction = styled(WalletAction)`
    color: ${({ theme }) => theme.primary1};
`

function renderTransactions(transactions: string[]) {
    return (
        <TransactionListWrapper>
            {transactions.map((hash, i) => {
                return <Transaction key={i} hash={hash} />
            })}
        </TransactionListWrapper>
    )
}

interface AccountDetailsProps {
    toggleWalletModal: () => void
    pendingTransactions: string[]
    confirmedTransactions: string[]
    ENSName?: string
    openOptions: () => void
}

export default function AccountDetails({
    toggleWalletModal,
    pendingTransactions,
    confirmedTransactions,
    ENSName,
    openOptions
}: AccountDetailsProps): any {
    const { chainId, account, connector } = useActiveWeb3React()
    const theme = useContext(ThemeContext)
    const dispatch = useDispatch<AppDispatch>()

    function formatConnectorName() {
        const { ethereum } = window
        const isMetaMask = !!(ethereum && ethereum.isMetaMask)
        const name = Object.keys(SUPPORTED_WALLETS)
            .filter(
                k =>
                    SUPPORTED_WALLETS[k].connector === connector &&
                    (connector !== injected || isMetaMask === (k === 'METAMASK'))
            )
            .map(k => SUPPORTED_WALLETS[k].name)[0]
        return `Connected with ${name}`
    }

    function getStatusIcon() {
        if (connector === injected) {
            return (
                <IconWrapper size={16}>
                    <Identicon />
                </IconWrapper>
            )
        } else if (connector === walletconnect) {
            return (
                <IconWrapper size={16}>
                    <img src={WalletConnectIcon} alt={'wallet connect logo'} />
                </IconWrapper>
            )
        } else if (connector === walletlink) {
            return (
                <IconWrapper size={16}>
                    <img src={CoinbaseWalletIcon} alt={'coinbase wallet logo'} />
                </IconWrapper>
            )
        } else if (connector === fortmatic) {
            return (
                <IconWrapper size={16}>
                    <img src={FortmaticIcon} alt={'fortmatic logo'} />
                </IconWrapper>
            )
        } else if (connector === portis) {
            return (
                <>
                    <IconWrapper size={16}>
                        <img src={PortisIcon} alt={'portis logo'} />
                        <MainWalletAction
                            onClick={() => {
                                portis.portis.showPortis()
                            }}
                        >
                            Show Portis
                        </MainWalletAction>
                    </IconWrapper>
                </>
            )
        } else if (connector === torus) {
            return (
                <IconWrapper size={16}>
                    <img src={TorusIcon} alt={'torus logo'} />
                </IconWrapper>
            )
        }
        return null
    }

    const clearAllTransactionsCallback = useCallback(() => {
        if (chainId) dispatch(clearAllTransactions({ chainId }))
    }, [dispatch, chainId])

    return (
        <>
            <UpperSection>
                <CloseIcon onClick={toggleWalletModal}>
                    <CloseColor />
                </CloseIcon>
                <Title className="text-center mb-8">Account</Title>
                <AccountSection>
                    <YourAccount>
                        <InfoCard>
                            <AccountGroupingRow>
                                {formatConnectorName()}
                                <div>
                                    {/*{connector !== injected && connector !== walletlink && (
                                        <WalletAction
                                            style={{ fontSize: '.825rem', fontWeight: 400, marginRight: '8px' }}
                                            onClick={() => {
                                                ;(connector as any).close()
                                            }}
                                        >
                                            Disconnect
                                        </WalletAction>
                                    )}*/}
                                    <WalletAction
                                        width={'75px'}
                                        size="sm"
                                        onClick={() => {
                                            openOptions()
                                        }}
                                    >
                                        Change
                                    </WalletAction>
                                </div>
                            </AccountGroupingRow>
                            <AccountGroupingRow id="web3-account-identifier-row">
                                <AccountControl>
                                    {ENSName ? (
                                        <>
                                            <div>
                                                <p> {ENSName}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p> {account && shortenAddress(account)}</p>
                                            </div>
                                        </>
                                    )}
                                </AccountControl>
                            </AccountGroupingRow>
                            <AccountGroupingRow className="mt-4">
                                {ENSName ? (
                                    <>
                                        <AccountControl>
                                            <div>
                                                {account && (
                                                    <Copy toCopy={account}>
                                                        <span style={{ marginLeft: '4px' }}>Copy address</span>
                                                    </Copy>
                                                )}
                                                {chainId && account && (
                                                    <AddressLink
                                                        hasENS={!!ENSName}
                                                        isENS={true}
                                                        href={chainId && getExplorerLink(chainId, ENSName, 'address')}
                                                    >
                                                        <span style={{ marginLeft: '4px' }}>View on explorer</span>
                                                    </AddressLink>
                                                )}
                                            </div>
                                        </AccountControl>
                                    </>
                                ) : (
                                    <>
                                        <AccountControl>
                                            <div>
                                                {account && (
                                                    <Copy toCopy={account}>
                                                        <span style={{ marginLeft: '4px' }}>Copy Address</span>
                                                    </Copy>
                                                )}
                                                {chainId && account && (
                                                    <AddressLink
                                                        hasENS={!!ENSName}
                                                        isENS={false}
                                                        href={getExplorerLink(chainId, account, 'address')}
                                                    >
                                                        <span style={{ marginLeft: '4px' }}>View on explorer</span>
                                                    </AddressLink>
                                                )}
                                            </div>
                                        </AccountControl>
                                    </>
                                )}
                            </AccountGroupingRow>
                        </InfoCard>
                    </YourAccount>
                </AccountSection>
            </UpperSection>
            {!!pendingTransactions.length || !!confirmedTransactions.length ? (
                <LowerSection>
                    <AutoRow mb={'1rem'} style={{ justifyContent: 'space-between' }}>
                        <TYPE.body>Recent Transactions</TYPE.body>
                        <LinkStyledButton onClick={clearAllTransactionsCallback}>(clear all)</LinkStyledButton>
                    </AutoRow>
                    {renderTransactions(pendingTransactions)}
                    {renderTransactions(confirmedTransactions)}
                </LowerSection>
            ) : (
                <LowerSection>Your transactions will appear here...</LowerSection>
            )}
        </>
    )
}
