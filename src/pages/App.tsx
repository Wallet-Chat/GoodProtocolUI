import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { AppBar, Popups } from '../components'
import Web3ReactManager from '../components/Web3ReactManager'
import Routes from '../routes'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../state'
import { updateUserDarkMode } from '../state/user/actions'
import { parse } from 'qs'
import isEqual from 'lodash/isEqual'
import SideBar from '../components/SideBar'
import styled from 'styled-components'
import { t } from '@lingui/macro'
import { useLingui } from '@lingui/react'
import { useFaucet } from '@gooddollar/web3sdk-v2'
import TransactionUpdater from '../state/transactions/updater'
import useSendAnalyticsData from 'hooks/useSendAnalyticsData'
import { isMobile } from 'react-device-detect'
import { WalletChatWidget } from 'react-wallet-chat'
import { useConnectWallet, useSetChain } from '@web3-onboard/react'
import { ethers } from 'ethers'
import { SiweMessage } from 'siwe'

export const Beta = styled.div`
    font-style: normal;
    font-weight: bold;
    font-size: 14px;
    line-height: 166%;
    letter-spacing: 0.35px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.text5};
    text-align: center;

    @media screen and (max-height: 720px) {
        font-size: 12px;
        margin-top: 30px;
    }
`

const Wrapper = styled.div`
    @media ${({ theme }) => theme.media.md} {
        padding-bottom: 75px;
    }
`

const MainBody = styled.div<{ $page?: string }>`
    ${({ $page }) =>
        $page === '/dashboard' &&
        `
    width: 80%;
    height: 100%;
    padding: 50px 20px 50px 20px;
  `}
    background-color: ${({ theme }) => theme.color.bgBody};
`

function App(): JSX.Element {
    const bodyRef = useRef<any>(null)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { location, replace } = useHistory()

    const { search, pathname } = useLocation()

    const dispatch = useDispatch<AppDispatch>()
    const [preservedSource, setPreservedSource] = useState('')
    const sendData = useSendAnalyticsData()
    const [{ chains, connectedChain }] = useSetChain()
    const [{ wallet }] = useConnectWallet()
    const connectedAccount = wallet?.accounts[0]
    const activeChain = chains.find((chain) => chain.id === connectedChain?.id)
    const chainId = activeChain?.token === 'CELO' ? 42_220 : 1
    const [signedMessage, setSignedMessage] = useState('')
    const [messageSignature, setMesssageSignature] = useState('')

    void useFaucet()

    useEffect(() => {
        sendData({ event: 'goto_page', action: `goto_${pathname}` })
    }, [pathname, sendData])

    useEffect(() => {
        //Test code for adding signature after wallet connection
        if (wallet) {
            const ethersProvider = new ethers.providers.Web3Provider(wallet.provider, 'any')

            const signer = ethersProvider.getSigner()
            signer
                .getAddress()
                .then((address) => {
                    const _domain = window.location.host
                    const _origin = window.location.protocol + '//' + _domain
                    const statement =
                        'You are signing a plain-text message to prove you own this wallet address. No gas fees or transactions will occur.'

                    const siweMessage = new SiweMessage({
                        domain: _domain,
                        address: address,
                        statement,
                        uri: _origin,
                        version: '1',
                        chainId,
                    })

                    const _signedMessage = siweMessage.prepareMessage()
                    setSignedMessage(_signedMessage)
                    signer
                        .signMessage(_signedMessage)
                        .then((_signature) => {
                            setMesssageSignature(_signature)
                        })
                        .catch((error) => {
                            console.error('🚨[Signature]:', error)
                        })
                })
                .catch((error) => {
                    console.error('🚨[Signer]:', error)
                })
        }
    }, [wallet, chainId])

    useEffect(() => {
        const parsed = parse(search, { parseArrays: false, ignoreQueryPrefix: true })

        if (!isEqual(parsed['utm_source'], preservedSource)) {
            setPreservedSource(parsed['utm_source'] as string)
        }

        if (preservedSource && !search.includes('utm_source')) {
            replace({
                ...location,
                search: search ? search + '&utm_source=' + preservedSource : search + '?utm_source=' + preservedSource,
            })
        }
    }, [preservedSource, location, replace, search])

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTo(0, 0)
        }
    }, [/* used */ pathname])

    useEffect(() => {
        if (!search) return
        if (search.length < 2) return

        const parsed = parse(search, {
            parseArrays: false,
            ignoreQueryPrefix: true,
        })

        const theme = parsed.theme

        if (typeof theme !== 'string') return

        if (theme.toLowerCase() === 'light') {
            dispatch(updateUserDarkMode({ userDarkMode: false }))
        } else if (theme.toLowerCase() === 'dark') {
            dispatch(updateUserDarkMode({ userDarkMode: true }))
        }
    }, [dispatch, search])

    const { i18n } = useLingui()

    return (
        <Suspense fallback={null}>
            <div className="flex flex-col h-screen overflow-hidden">
                <AppBar />
                <Wrapper className="flex flex-grow overflow-hidden">
                    {!isMobile && <SideBar />}
                    <MainBody
                        ref={bodyRef}
                        className="z-0 flex flex-col items-center justify-between flex-grow h-full px-4 pt-4 pb-4 overflow-x-hidden overflow-y-auto sm:pt-8 md:pt-10"
                        $page={location.pathname}
                    >
                        <Popups />
                        <Web3ReactManager>
                            <div
                                className={`flex flex-col flex-glow w-full justify-start items-center
                             ${location.pathname === '/dashboard' ? 'md:auto' : 'md:h-screen'}
                             ${location.pathname === '/claim' && 'transform sm:scale-75 xl:scale-100'}
                             md:justify-center`}
                            >
                                <Routes />
                                <TransactionUpdater />
                            </div>
                        </Web3ReactManager>
                        <Beta className="mt-3 lg:mt-8">{i18n._(t`This project is in beta. Use at your own risk`)}</Beta>
                    </MainBody>
                </Wrapper>
                <WalletChatWidget
                    style={{ marginBottom: isMobile ? '75px' : '0px' }}
                    connectedWallet={
                        connectedAccount &&
                        chainId && {
                            walletName: wallet.label,
                            account: connectedAccount.address,
                            chainId,
                        }
                    }
                    signedMessageData={
                        signedMessage && messageSignature
                            ? {
                                  signature: messageSignature,
                                  signedMsg: signedMessage,
                              }
                            : undefined
                    }
                />
            </div>
        </Suspense>
    )
}

export default App
