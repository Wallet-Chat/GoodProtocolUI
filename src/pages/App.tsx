import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { AppBar, Polling, Popups } from '../components'
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
import TransactionUpdater from '../state/transactions/updater'

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

const MainBody = styled.div`
  background-color: ${({theme}) => theme.color.bgBody};
  @media screen and (max-width: 361px){
    padding-bottom: 20px;
    height: 600px;
    padding-top: 170px;
  }

  @media screen and (min-width: 361px) and (max-width: 375px){
    height: 490px;
    padding-top: 270px;
  }

  @media screen and (min-width: 390px) and (max-width: 550px){
    height: 700px;
    padding-top: 70px;
    padding-left: 1.65rem
  }

  @media screen and (min-width: 500px) and (max-width: 550px){
    height: 560px;
    padding-top: 200px;
  }
  @media screen and (min-width: 550px) {
    margin-top: -50px
  }

`

function App(): JSX.Element {
    const bodyRef = useRef<any>(null)

    const { location, replace } = useHistory()

    const { search, pathname } = useLocation()

    const dispatch = useDispatch<AppDispatch>()
    const [preservedSource, setPreservedSource] = useState('')

    useEffect(() => {
        const parsed = parse(location.search, { parseArrays: false, ignoreQueryPrefix: true })

        if (!isEqual(parsed['utm_source'], preservedSource)) {
            setPreservedSource(parsed['utm_source'] as string)
        }

        if (preservedSource && !location.search.includes('utm_source')) {
            replace({
                ...location,
                search: location.search
                    ? location.search + '&utm_source=' + preservedSource
                    : location.search + '?utm_source=' + preservedSource
            })
        }
    }, [preservedSource, location, replace])

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTo(0, 0)
        }
    }, [pathname])

    useEffect(() => {
        if (!search) return
        if (search.length < 2) return

        const parsed = parse(search, {
            parseArrays: false,
            ignoreQueryPrefix: true
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
            <div className="flex flex-col h-max md:overflow-hidden">
                <AppBar />
                <Wrapper className="flex flex-grow md:overflow-hidden">
                    <SideBar />
                    <MainBody
                        ref={bodyRef}
                        className="z-0 flex flex-col items-center justify-center flex-grow h-screen px-4 pb-5 md:overflow-x-hidden overflow-y-auto"
                    >
                        <Popups />
                        {/*<Polling />*/}
                        <Web3ReactManager>
                          <div className="flex flex-col items-center justify-center w-full xl:-mt-9">
                                <Routes />
                                <TransactionUpdater />
                          </div>
                        </Web3ReactManager>
                        <Beta className="mt-3 lg:mt-8">{i18n._(t`This project is in beta. Use at your own risk`)}</Beta>
                    </MainBody>
                </Wrapper>
            </div>
        </Suspense>
    )
}

export default App
