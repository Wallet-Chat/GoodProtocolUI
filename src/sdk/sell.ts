import Web3 from "web3";
import { Trade } from "@uniswap/v2-sdk";
import { Currency, CurrencyAmount, Fraction, Percent, Token, TradeType } from "@uniswap/sdk-core";

import { getToken } from "./methods/tokenLists";
import { calculateExitContribution } from "./methods/calculateExitContribution";
import { decimalPercentToPercent, g$FromDecimal } from "./utils/converter";
import { CDAI, G$ } from "./constants/tokens";
import { cDaiPrice } from "./methods/cDaiPrice";
import { v2TradeExactIn } from "./methods/v2TradeExactIn";
import { BuyInfo } from "./buy";
import { goodMarketMakerContract } from "./contracts/GoodMarketMakerContract";
import { getAccount, getChainId } from "./utils/web3";
import { debug, debugGroup, debugGroupEnd } from "./utils/debug";
import { InsufficientLiquidity, UnexpectedToken } from "./utils/errors";
import { computeRealizedLPFeePercent } from "./utils/prices";
import { tokenBalance } from "./utils/tokenBalance";
import { BigNumber, ethers } from "ethers";
import { exchangeHelperContract } from "./contracts/ExchangeHelperContract";
import { ERC20Contract } from "./contracts/ERC20Contract";
import { EXCHANGE_HELPER_ADDRESS } from "./constants/addresses";
import { cacheClear } from "./utils/memoize";
import { SupportedChainId } from "./constants/chains";

export type SellInfo = { contribution: Fraction } & BuyInfo

type XResult = {
  amount: CurrencyAmount<Currency>
  minAmount: CurrencyAmount<Currency>
  route: Token[],
  trade: Trade<Currency, Currency, TradeType>
}

type CDAIResult = Omit<XResult, 'route' | 'trade'>

/**
 * Tries to convert token DAI into X. If it impossible - returns null.
 * @param {Web3} web3 Web3 instance.
 * @param {CurrencyAmount<Currency>} currency DAI token amount.
 * @param {Token} to Token X to convert to.
 * @param {Percent} slippageTolerance Slippage tolerance.
 * @returns {DAIResult | null}
 */
async function DaiToX(web3: Web3, currency: CurrencyAmount<Currency>, to: Token, slippageTolerance: Percent): Promise<XResult | null> {
  const chainId = await getChainId(web3)

  debugGroup(`DAI to ${ to.symbol }`)

  const trade = await v2TradeExactIn(currency, to, { chainId })
  if (!trade) {
    debug('Trade', null)
    debugGroupEnd(`DAI to ${ to.symbol }`)

    return null
  }

  const amount = trade.outputAmount
  debug(to.symbol, amount.toSignificant(6))

  const minAmount = trade.minimumAmountOut(slippageTolerance)
  debug(`${ to.symbol } min`, minAmount.toSignificant(6))

  debugGroupEnd(`DAI to ${ to.symbol }`)

  return { amount, minAmount, route: trade.route.path, trade }
}

/**
 * Tries to convert token G$ into X. If it impossible - returns null.
 * @param {Web3} web3 Web3 instance.
 * @param {CurrencyAmount<Currency>} currency DAI token amount.
 * @param {Token} to Token X to convert to.
 * @param {Percent} slippageTolerance Slippage tolerance.
 * @returns {DAIResult | null}
 */
async function G$ToX(web3: Web3, currency: CurrencyAmount<Currency>, to: Token, slippageTolerance: Percent): Promise<XResult | null> {
  const chainId = await getChainId(web3)

  debugGroup(`G$ to ${ to.symbol }`)

  const trade = await v2TradeExactIn(currency, to, { chainId })
  if (!trade) {
    debug('Trade', null)
    debugGroupEnd(`G$ to ${ to.symbol }`)

    return null
  }

  const amount = trade.outputAmount
  debug(to.symbol, amount.toSignificant(6))

  const minAmount = trade.minimumAmountOut(slippageTolerance)
  debug(`${ to.symbol } min`, minAmount.toSignificant(6))

  debugGroupEnd(`G$ to ${ to.symbol }`)

  return { amount, minAmount, route: trade.route.path, trade }
}

/**
 * Tries to convert token cDAI into DAI.
 * @param {Web3} web3 Web3 instance.
 * @param {CurrencyAmount<Currency>} currency CDAI token amount.
 * @returns {CurrencyAmount<Currency>}
 * @throws {UnexpectedToken} If currency not DAI.
 */
async function cDaiToDai(web3: Web3, currency: CurrencyAmount<Currency>): Promise<CurrencyAmount<Currency>> {
  if (currency.currency.symbol !== 'cDAI') {
    throw new UnexpectedToken(currency.currency.symbol)
  }

  const chainId = await getChainId(web3)
  const DAI = await getToken(chainId, 'DAI') as Token

  debugGroup(`cDAI to DAI`)

  const cDaiPriceRatio = await cDaiPrice(web3, chainId)
  debug('cDAI ratio', cDaiPriceRatio.toSignificant(6))

  // DAI is 18 decimal number, cDAI is 8 decimal number, need to add 10 - 8 = 10 decimals from final value
  const _daiAmount = currency.multiply(cDaiPriceRatio).multiply(1e10)
  const amount = CurrencyAmount.fromFractionalAmount(DAI, _daiAmount.numerator, _daiAmount.denominator)

  debug('cDAI', amount.toSignificant(6))
  debugGroupEnd(`cDAI to DAI`)

  return amount
}

/**
 * Tries to convert token G$ into cDAI.
 * @param {Web3} web3 Web3 instance.
 * @param {CurrencyAmount<Currency>} currency G$ token amount.
 * @param {Percent} slippageTolerance Slippage tolerance.
 * @returns {CDAIResult}
 * @throws {UnexpectedToken} If currency not cDAI.
 */
async function G$ToCDai(web3: Web3, currency: CurrencyAmount<Currency>, slippageTolerance: Percent): Promise<CDAIResult> {
  if (currency.currency.symbol !== 'G$') {
    throw new UnexpectedToken(currency.currency.symbol)
  }

  const chainId = await getChainId(web3)
  const goodMarketMaker = await goodMarketMakerContract(web3)

  debugGroup(`G$ to cDAI`)

  const bigNumber = currency.multiply(currency.decimalScale).toFixed(0)
  const _cDaiOutput = await goodMarketMaker.methods.sellReturn(CDAI[chainId].address, bigNumber).call()

  const amount = CurrencyAmount.fromRawAmount(CDAI[chainId], _cDaiOutput.toString())
  debug('cDAI', amount.toSignificant(6))

  const minAmount = amount.subtract(amount.multiply(slippageTolerance))
  debug('cDAI min', minAmount.toSignificant(6))

  debugGroupEnd(`G$ to cDAI`)

  return { amount, minAmount }
}

/**
 * Calculates liquidity fee and price impact on uniswap.
 * @param {Trade<Currency, Currency, TradeType>} trade Trade returned by uniswap.
 * @returns {{ liquidityFee: CurrencyAmount<Currency>, priceImpact: Percent }}
 */
export function realizedLPFeePriceImpact(trade: Trade<Currency, Currency, TradeType>): { liquidityFee: CurrencyAmount<Currency>, priceImpact: Percent } {
  const realizedLpFeePercent = computeRealizedLPFeePercent(trade)
  const priceImpact = trade.priceImpact.subtract(realizedLpFeePercent)
  const liquidityFee = trade.inputAmount.multiply(realizedLpFeePercent)

  debug('Price impact', priceImpact.toSignificant(6))
  debug('Liquidity fee', liquidityFee.toSignificant(6))

  return { liquidityFee, priceImpact }
}

/**
 * Returns trade information for selling G$.
 * @param {Web3} web3 Web3 instance.
 * @param {string} toSymbol Symbol of the token that you want to get while selling G$.
 * @param {number | string} amount Amount of given currency.
 * @param {number} slippageTolerance Slippage tolerance while exchange tokens.
 */
export async function getMeta(web3: Web3, toSymbol: string, amount: number | string, slippageTolerance: number = 0.5): Promise<SellInfo | null> {
  const chainId = await getChainId(web3)
  const account = await getAccount(web3)

  debugGroup(`Get meta ${ amount } G$ to ${ toSymbol }`)

  cacheClear(cDaiPrice)

  const G$ = await getToken(chainId, 'G$') as Token
  if (!G$) {
    throw new Error('Unsupported chain ID')
  }

  const TO = await getToken(chainId, toSymbol) as Token

  if (!TO) {
    throw new Error('Unsupported token')
  }

  const DAI = await getToken(chainId, 'DAI') as Token

  let DAIAmount: CurrencyAmount<Currency | Token> | null = null
  let cDAIAmount: CurrencyAmount<Currency | Token> | null = null

  let inputAmount: CurrencyAmount<Currency> = await g$FromDecimal(chainId, amount)
  let outputAmount: CurrencyAmount<Currency>
  let minimumOutputAmount: CurrencyAmount<Currency>
  let route: Token[]

  let priceImpact: Fraction = new Fraction(0)
  let liquidityFee: Fraction = new Fraction(0)
  let GDXBalance: CurrencyAmount<Currency> | Fraction = new Fraction(0)

  let contribution = new Fraction(0)

  const slippageTolerancePercent = decimalPercentToPercent(slippageTolerance)

  if (chainId === SupportedChainId.FUSE) {
    const trade = await G$ToX(web3, inputAmount, TO, slippageTolerancePercent)
    if (!trade) {
      return null
    }

    ;({ priceImpact, liquidityFee } = realizedLPFeePriceImpact(trade.trade));
    ;({ amount: outputAmount, minAmount: minimumOutputAmount, route } = trade);
  } else {
    contribution = await calculateExitContribution(web3, inputAmount, account)
    if (TO.symbol === 'G$') {
      return null
    } else if (TO.symbol === 'cDAI') {
      ;({
        amount: outputAmount,
        minAmount: minimumOutputAmount
      } = await G$ToCDai(web3, inputAmount, slippageTolerancePercent));

      DAIAmount = CurrencyAmount.fromRawAmount(DAI, 0)
      cDAIAmount = minimumOutputAmount

      route = [CDAI[chainId]]
    } else if (TO.symbol === 'DAI') {
      ;({ amount: outputAmount, minAmount: cDAIAmount } = await G$ToCDai(web3, inputAmount, slippageTolerancePercent));

      minimumOutputAmount = DAIAmount = await cDaiToDai(web3, cDAIAmount)
      outputAmount = await cDaiToDai(web3, outputAmount)

      route = [DAI]
    } else {
      ;({ minAmount: cDAIAmount } = await G$ToCDai(web3, inputAmount, slippageTolerancePercent));

      DAIAmount = await cDaiToDai(web3, cDAIAmount)

      const trade = await DaiToX(web3, DAIAmount, TO, slippageTolerancePercent)
      if (!trade) {
        return null
      }

      ;({ priceImpact, liquidityFee } = realizedLPFeePriceImpact(trade.trade));
      ;({ amount: outputAmount, minAmount: minimumOutputAmount, route } = trade);
    }

    GDXBalance = await tokenBalance(web3, 'GDX', account)
  }

  debugGroupEnd(`Get meta ${ amount } G$ to ${ toSymbol }`)

  return {
    inputAmount,
    outputAmount,
    minimumOutputAmount,

    DAIAmount,
    cDAIAmount,
    GDXAmount: inputAmount.lessThan(GDXBalance) ? inputAmount : GDXBalance,

    priceImpact,
    slippageTolerance: slippageTolerancePercent,
    contribution,

    liquidityFee,
    liquidityToken: DAI,

    route
  }
}

/**
 * Pick necessary date from meta swap.
 * @param {BuyInfo} meta Result of the method getMeta() execution.
 * @returns {input: string, minReturn: string, minCDai: string}
 */
function prepareValues(meta: BuyInfo): { input: string, minReturn: string, minCDai: string } {
  if (!meta.route.length) {
    throw new InsufficientLiquidity()
  }

  const input = meta.inputAmount.multiply(meta.inputAmount.decimalScale).toFixed(0)
  const minReturn = meta.minimumOutputAmount.multiply(meta.minimumOutputAmount.decimalScale).toFixed(0)
  const minCDai = meta.cDAIAmount ? meta.cDAIAmount.multiply(meta.cDAIAmount.decimalScale).toFixed(0) : '0'

  debug({
    input: meta.inputAmount.toSignificant(6),
    minReturn: meta.minimumOutputAmount.toSignificant(6),
    minCDai: meta.cDAIAmount ? meta.cDAIAmount.toSignificant(6) : '0'
  })

  return { input, minReturn, minCDai }
}

/**
 * Approve token usage.
 * @param {Web3} web3 Web3 instance.
 * @param {BuyInfo} meta Result of the method getMeta() execution.
 */
export async function approve(web3: Web3, meta: BuyInfo): Promise<void> {
  const chainId = await getChainId(web3)
  const account = await getAccount(web3)

  const { input } = prepareValues(meta)
  // Approve ERC20 token to exchange
  await ERC20Contract(web3, G$[chainId].address).methods.approve(EXCHANGE_HELPER_ADDRESS[chainId], input).send({ from: account })
}

/**
 * Swap tokens.
 * @param {Web3} web3 Web3 instance.
 * @param {BuyInfo} meta Result of the method getMeta() execution.
 */
export async function sell(web3: Web3, meta: BuyInfo): Promise<void> {
  const account = await getAccount(web3)

  const contract = await exchangeHelperContract(web3)

  const { input, minReturn, minCDai } = prepareValues(meta)

  // Convert into addresses
  let route: string[] = meta.route.map(token => token.address)

  await contract.methods.sell(
    route,
    BigNumber.from(input),
    BigNumber.from(minCDai),
    BigNumber.from(minReturn),
    ethers.constants.AddressZero
  ).send({ from: account })
}