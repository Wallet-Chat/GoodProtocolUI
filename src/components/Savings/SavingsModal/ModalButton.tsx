import React, { useCallback } from 'react'
import sendGa from 'functions/sendGa'
import { ModalType } from '.'
import { ActionOrSwitchButton } from 'components/gd/Button/ActionOrSwitchButton'
import { SupportedV2Network, SupportedV2Networks } from '@gooddollar/web3sdk-v2'

export interface ModalButtonProps {
    chain: number
    type: ModalType
    title: string
    toggleModal: (type?: ModalType) => void
}
export const ModalButton = ({ chain, type, title, toggleModal, ...props }: ModalButtonProps) => {
    const onClick = useCallback(() => {
        sendGa({ event: 'savings', action: 'start' + type })
        toggleModal(type)
    }, [toggleModal, type])

    const requireChain = SupportedV2Networks[chain] as SupportedV2Network

    return (
        <ActionOrSwitchButton
            width="130px"
            size="sm"
            borderRadius="6px"
            requireChain={requireChain}
            noShadow={true}
            onClick={onClick}
            {...props}
        >
            {' '}
            {title}{' '}
        </ActionOrSwitchButton>
    )
}
