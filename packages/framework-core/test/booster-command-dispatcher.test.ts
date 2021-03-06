/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Booster } from '../src/booster'
import { fake, replace, restore } from 'sinon'
import * as chai from 'chai'
import { expect } from 'chai'
import { Library as AWS } from '@boostercloud/framework-provider-aws'
import { BoosterCommandDispatcher } from '../src/booster-command-dispatcher'
import { BoosterConfig, Provider, Logger, Register } from '@boostercloud/framework-types'
import { Command } from '../src/decorators'

chai.use(require('sinon-chai'))

describe('the `BoosterCommandsDispatcher`', () => {
  afterEach(() => {
    restore()
    Booster.configure((config) => {
      config.appName = ''
      for (const propName in config.commandHandlers) {
        delete config.commandHandlers[propName]
      }
    })
  })

  const logger: Logger = {
    debug() {},
    info() {},
    error() {},
  }

  describe('the `dispatch` method', () => {
    it('calls the AWS `rawCommandToEnvelope` if the current set provider is AWS', async () => {
      const boosterCommandDispatcher = BoosterCommandDispatcher
      const fakeAWSRawCommandToEnvelope = fake()
      replace(AWS, 'rawCommandToEnvelope', fakeAWSRawCommandToEnvelope)
      replace(AWS, 'handleCommandResult', fake())
      replace(boosterCommandDispatcher as any, 'dispatchCommand', fake())
      replace(boosterCommandDispatcher as any, 'eventEnvelopesFromRegister', fake())

      const config = new BoosterConfig()
      config.provider = Provider.AWS
      await boosterCommandDispatcher.dispatch({ body: 'Test body' }, config, logger)

      expect(fakeAWSRawCommandToEnvelope).to.have.been.calledOnce
    })

    it('dispatches the message', async () => {
      const fakeDispatch = fake()
      const boosterCommandDispatcher = BoosterCommandDispatcher
      replace(AWS, 'rawCommandToEnvelope', fake())
      replace(AWS, 'handleCommandResult', fake())
      replace(boosterCommandDispatcher as any, 'eventEnvelopesFromRegister', fake())
      replace(boosterCommandDispatcher as any, 'dispatchCommand', fakeDispatch)

      const config = new BoosterConfig()
      config.provider = Provider.AWS
      await boosterCommandDispatcher.dispatch({ body: 'Test body' }, config, logger)

      expect(fakeDispatch).to.have.been.calledOnce
    })

    it('calls the AWS `handleCommandResult` if the current provider is AWS and there were no errors', async () => {
      const boosterCommandDispatcher = BoosterCommandDispatcher
      const fakeHandle = fake()
      replace(AWS, 'rawCommandToEnvelope', fake())
      replace(AWS, 'handleCommandResult', fakeHandle)
      replace(boosterCommandDispatcher as any, 'dispatchCommand', fake())
      replace(boosterCommandDispatcher as any, 'eventEnvelopesFromRegister', fake())

      const config = new BoosterConfig()
      config.provider = Provider.AWS
      await boosterCommandDispatcher.dispatch({ body: 'Test body' }, config, logger)

      expect(fakeHandle).to.have.been.calledOnce
    })
  })

  describe('private methods', () => {
    describe('the `dispatchCommand` method', () => {
      it('calls the handler method of a registered command', () => {
        @Command({ authorize: 'all' })
        class PostComment {
          public constructor(readonly comment: string) {}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          public handle(_register: Register): void {
            throw new Error('Not implemented')
          }
        }
        const boosterCommandDispatcher = BoosterCommandDispatcher as any
        const fakeHandler = fake()
        const command = new PostComment('This test is good!')
        replace(command, 'handle', fakeHandler)

        Booster.configure((config): void => {
          boosterCommandDispatcher.dispatchCommand(
            { version: 1, typeName: 'PostComment', value: command },
            config,
            logger
          )
        })

        expect(fakeHandler).to.have.been.calledOnce
      })

      it('fails if the command "version" is not sent', () => {
        const command = {
          typeName: 'PostComment',
          value: { comment: 'This comment is pointless' },
        }
        const boosterCommandDispatcher = BoosterCommandDispatcher as any
        Booster.configure((config) => {
          // We use `bind` to generate a thunk that chai will then call, checking that it throws
          expect(
            boosterCommandDispatcher.dispatchCommand.bind(boosterCommandDispatcher, command, config, logger)
          ).to.throw('The required command "version" was not present')
        })
      })

      it('fails if the command is not registered', () => {
        const command = {
          version: 1,
          typeName: 'PostComment',
          value: { comment: 'This comment is pointless' },
        }
        const boosterCommandDispatcher = BoosterCommandDispatcher as any
        Booster.configure((config) => {
          // We use `bind` to generate a thunk that chai will then call, checking that it throws
          expect(
            boosterCommandDispatcher.dispatchCommand.bind(boosterCommandDispatcher, command, config, logger)
          ).to.throw("Couldn't find a proper handler for PostComment")
        })
      })
    })
  })
})
