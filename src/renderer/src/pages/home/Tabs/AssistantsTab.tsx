import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import DragableList from '@renderer/components/DragableList'
import CopyIcon from '@renderer/components/Icons/CopyIcon'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAgents } from '@renderer/hooks/useAgents'
import { useAssistant, useAssistants } from '@renderer/hooks/useAssistant'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import AssistantSettingsPopup from '@renderer/pages/settings/AssistantSettings'
import { getDefaultTopic } from '@renderer/services/AssistantService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { Assistant, AssistantGroup } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { Dropdown, Input } from 'antd'
import { ItemType } from 'antd/es/menu/interface'
import { last, omit } from 'lodash'
import { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  activeAssistant: Assistant
  setActiveAssistant: (assistant: Assistant) => void
  onCreateDefaultAssistant: () => void
  onCreateAssistant: () => void
}

const Assistants: FC<Props> = ({
  activeAssistant,
  setActiveAssistant,
  onCreateAssistant,
  onCreateDefaultAssistant
}) => {
  const {
    assistants,
    removeAssistant,
    addAssistant,
    updateAssistants,
    groups,
    moveAssistantToGroup,
    addGroup,
    updateGroup,
    removeGroup
  } = useAssistants()
  const [dragging, setDragging] = useState(false)
  const { removeAllTopics } = useAssistant(activeAssistant.id)
  const { clickAssistantToShowTopic, topicPosition } = useSettings()
  const { t } = useTranslation()
  const { addAgent } = useAgents()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const onDelete = useCallback(
    (assistant: Assistant) => {
      const _assistant: Assistant | undefined = last(assistants.filter((a) => a.id !== assistant.id))
      _assistant ? setActiveAssistant(_assistant) : onCreateDefaultAssistant()
      removeAssistant(assistant.id)
    },
    [assistants, onCreateDefaultAssistant, removeAssistant, setActiveAssistant]
  )

  const getMenuItems = useCallback(
    (assistant: Assistant) =>
      [
        {
          label: t('assistants.edit.title'),
          key: 'edit',
          icon: <EditOutlined />,
          onClick: () => AssistantSettingsPopup.show({ assistant })
        },
        {
          label: t('assistants.copy.title'),
          key: 'duplicate',
          icon: <CopyIcon />,
          onClick: async () => {
            const _assistant: Assistant = { ...assistant, id: uuid(), topics: [getDefaultTopic(assistant.id)] }
            addAssistant(_assistant)
            setActiveAssistant(_assistant)
          }
        },
        {
          label: t('assistants.clear.title'),
          key: 'clear',
          icon: <MinusCircleOutlined />,
          onClick: () => {
            window.modal.confirm({
              title: t('assistants.clear.title'),
              content: t('assistants.clear.content'),
              centered: true,
              okButtonProps: { danger: true },
              onOk: removeAllTopics
            })
          }
        },
        {
          label: t('assistants.save.title'),
          key: 'save-to-agent',
          icon: <SaveOutlined />,
          onClick: async () => {
            const agent = omit(assistant, ['model', 'emoji'])
            agent.id = uuid()
            agent.type = 'agent'
            addAgent(agent)
            window.message.success({
              content: t('assistants.save.success'),
              key: 'save-to-agent'
            })
          }
        },
        {
          label: t('assistants.moveToGroup'),
          key: 'moveToGroup',
          icon: <FolderOutlined />,
          children: [
            {
              label: t('assistants.ungrouped'),
              key: 'ungrouped',
              onClick: () => moveAssistantToGroup(assistant.id, '')
            },
            ...(groups || []).map((group) => ({
              label: group.name,
              key: group.id,
              onClick: () => moveAssistantToGroup(assistant.id, group.id)
            }))
          ]
        },
        { type: 'divider' },
        {
          label: t('common.delete'),
          key: 'delete',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            window.modal.confirm({
              title: t('assistants.delete.title'),
              content: t('assistants.delete.content'),
              centered: true,
              okButtonProps: { danger: true },
              onOk: () => onDelete(assistant)
            })
          }
        }
      ] as ItemType[],
    [addAgent, addAssistant, onDelete, removeAllTopics, setActiveAssistant, t, groups, moveAssistantToGroup]
  )

  const onSwitchAssistant = useCallback(
    async (assistant: Assistant) => {
      await modelGenerating()

      if (topicPosition === 'left' && clickAssistantToShowTopic) {
        EventEmitter.emit(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR)
      }

      setActiveAssistant(assistant)
    },
    [clickAssistantToShowTopic, setActiveAssistant, topicPosition]
  )

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: groupId === '' ? true : !prev[groupId]
    }))
  }, [])

  const getGroupMenuItems = useCallback(
    (group: AssistantGroup) =>
      [
        {
          label: t('assistants.editGroup'),
          key: 'edit',
          icon: <EditOutlined />,
          onClick: () => {
            let newName = group.name
            window.modal.confirm({
              title: t('assistants.editGroup'),
              content: <Input defaultValue={group.name} autoFocus onChange={(e) => (newName = e.target.value)} />,
              onOk: () => {
                updateGroup({ ...group, name: newName.trim() })
              }
            })
          }
        },
        { type: 'divider' },
        {
          label: t('common.delete'),
          key: 'delete',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            window.modal.confirm({
              title: t('assistants.deleteGroupConfirm'),
              content: t('assistants.deleteGroupContent'),
              okButtonProps: { danger: true },
              onOk: () => removeGroup(group.id)
            })
          }
        }
      ] as ItemType[],
    [t, updateGroup, removeGroup]
  )

  const createNewGroup = useCallback(() => {
    let inputValue = ''
    window.modal.confirm({
      title: t('assistants.addGroup'),
      content: <Input autoFocus onChange={(e) => (inputValue = e.target.value)} />,
      onOk: () => {
        if (inputValue.trim()) {
          addGroup({
            id: uuid(),
            name: inputValue.trim(),
            order: 1
          })
        }
      }
    })
  }, [addGroup, t])

  // 新增扁平化数据结构和拖动更新处理逻辑
  const getFlattenList = () => {
    const list: any[] = []

    groups.forEach((group) => {
      list.push({ type: 'group', ...group })
      if (expandedGroups[group.id]) {
        list.push(...assistants.filter((a) => a.groupId === group.id).map((a) => ({ ...a, type: 'assistant' })))
      }
    })

    list.push({
      type: 'group',
      id: '',
      name: t('assistants.ungrouped')
    })

    if (expandedGroups[''] !== false) {
      list.push(...assistants.filter((a) => !a.groupId).map((a) => ({ ...a, type: 'assistant' })))
    }

    return list
  }

  const handleDragUpdate = (newList: any[]) => {
    const originalAssistantsMap = new Map(assistants.map((a) => [a.id, a]))
    const updatedAssistants: Assistant[] = []
    let currentGroupId = ''

    // 跟踪受影响的分组
    const affectedGroups = new Set<string>()

    newList.forEach((item) => {
      if (item.type === 'group') {
        currentGroupId = item.id === 'ungrouped' ? '' : item.id
        affectedGroups.add(currentGroupId)
      } else {
        const original = originalAssistantsMap.get(item.id)
        const newGroupId = currentGroupId === 'ungrouped' ? '' : currentGroupId

        // 如果分组发生了变化，将目标分组添加到受影响列表
        if (original?.groupId !== newGroupId) {
          affectedGroups.add(currentGroupId)
        }

        updatedAssistants.push({
          ...original,
          ...item,
          groupId: newGroupId
        })
      }
    })

    assistants.forEach((assistant) => {
      if (!updatedAssistants.some((a) => a.id === assistant.id)) {
        updatedAssistants.push(assistant)
      }
    })

    // 自动展开受影响的分组
    setExpandedGroups((prev) => ({
      ...prev,
      ...Array.from(affectedGroups).reduce(
        (acc, groupId) => {
          if (groupId !== 'ungrouped') {
            acc[groupId] = true // 强制展开受影响的分组
          }
          return acc
        },
        {} as Record<string, boolean>
      )
    }))

    updateAssistants(updatedAssistants)
  }

  const renderAssistantItem = (assistant: Assistant) => {
    return (
      <Dropdown key={assistant.id} menu={{ items: getMenuItems(assistant) }} trigger={['contextMenu']}>
        <AssistantItem
          $hasGroup={!!assistant.groupId}
          onClick={() => onSwitchAssistant(assistant)}
          className={assistant.id === activeAssistant?.id ? 'active' : ''}>
          <AssistantName className="name">{assistant.name || t('chat.default.name')}</AssistantName>
          {assistant.id === activeAssistant?.id && (
            <MenuButton onClick={() => EventEmitter.emit(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR)}>
              <TopicCount className="topics-count">{assistant.topics.length}</TopicCount>
            </MenuButton>
          )}
        </AssistantItem>
      </Dropdown>
    )
  }

  return (
    <Container className="assistants-tab">
      <DragableList
        list={getFlattenList()}
        onUpdate={handleDragUpdate}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}>
        {(item) => {
          if (item.type === 'group') {
            return (
              <Dropdown key={item.id} menu={{ items: getGroupMenuItems(item) }} trigger={['contextMenu']}>
                <GroupHeader onClick={() => toggleGroup(item.id)}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {expandedGroups[item.id] ? <CaretDownOutlined /> : <CaretRightOutlined />}
                    <GroupName>{item.name}</GroupName>
                  </div>
                  <CountBadge>
                    {item.id === 'ungrouped'
                      ? assistants.filter((a) => !a.groupId).length
                      : assistants.filter((a) => a.groupId === item.id).length}
                  </CountBadge>
                </GroupHeader>
              </Dropdown>
            )
          }
          return renderAssistantItem(item)
        }}
      </DragableList>

      {!dragging && (
        <>
          <AssistantItem onClick={onCreateAssistant}>
            <AssistantName>
              <PlusOutlined style={{ marginRight: 4 }} />
              {t('chat.add.assistant.title')}
            </AssistantName>
          </AssistantItem>
          <GroupItem onClick={createNewGroup}>
            <FolderAddOutlined style={{ marginRight: 4 }} />
            {t('assistants.addGroup')}
          </GroupItem>
        </>
      )}
      <div style={{ minHeight: 10 }}></div>
    </Container>
  )
}

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  padding-top: 11px;
  user-select: none;
`

const AssistantItem = styled.div<{ $hasGroup?: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 7px 12px;
  position: relative;
  margin: 0 10px;
  padding-right: 35px;
  font-family: Ubuntu;
  border-radius: var(--list-item-border-radius);
  border: 0.5px solid transparent;
  cursor: pointer;
  ${({ $hasGroup }) => $hasGroup && 'padding-left: 24px; margin-top: 5px;'}
  .iconfont {
    opacity: 0;
    color: var(--color-text-3);
  }
  &:hover {
    background-color: var(--color-background-soft);
  }
  &.active {
    background-color: var(--color-background-soft);
    border: 0.5px solid var(--color-border);
    .name {
    }
  }
`

const AssistantName = styled.div`
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
`

const MenuButton = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  min-width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  border-radius: 11px;
  position: absolute;
  background-color: var(--color-background);
  right: 9px;
  top: 6px;
`

const TopicCount = styled.div`
  color: var(--color-text);
  font-size: 10px;
  border-radius: 10px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
`

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  margin: 0 10px;
  cursor: pointer;
  border-radius: var(--list-item-border-radius);
  position: relative;
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 24px;
    right: 0;
    height: 1px;
    background: var(--color-border);
    transition: all 0.3s;
  }
  &:hover::after {
    background: var(--color-primary);
  }
`

const CountBadge = styled.span`
  background: var(--color-background);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-text-3);
  min-width: 25px;
  text-align: center;
`

const GroupName = styled.div`
  margin-left: 8px;
  font-size: 13px;
  color: var(--color-text);
`

const GroupItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  margin: 0 10px 8px;
  cursor: pointer;
  color: var(--color-text);
  border-radius: var(--list-item-border-radius);
  &:hover {
    background-color: var(--color-background-soft);
  }
  .anticon {
    font-size: 14px;
  }
`

export default Assistants
