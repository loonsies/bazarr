import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Group,
  Slider as MantineSlider,
  Table,
  Text,
} from "@mantine/core";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { capitalize } from "lodash";
import { Action, Selector } from "@/components";
import { ProviderList } from "@/pages/Settings/Providers/list";
import { useFormActions } from "@/pages/Settings/utilities/FormValues";
import { useSettingValue } from "@/pages/Settings/utilities/hooks";
import { useSliderMarks } from "@/utilities";

const emptyList: string[] = [];

type ProviderScoreException = {
  provider: string;
  score: number;
};

type Props = {
  label: string;
  settingKey: string;
  defaultScoreKey: string;
};

type SliderProps = {
  marks: ReturnType<typeof useSliderMarks>;
  provider: string;
  score: number;
  onChange: (provider: string, score: number) => void;
};

function decodeProviderScoreException(
  value: string,
): ProviderScoreException | null {
  const parts = value.split(":");

  if (parts.length !== 2) {
    return null;
  }

  const [provider, rawScore] = parts;
  const score = Number(rawScore);

  if (!provider || !Number.isInteger(score) || score < 0 || score > 100) {
    return null;
  }

  return {
    provider,
    score,
  };
}

function encodeProviderScoreException({
  provider,
  score,
}: ProviderScoreException) {
  return `${provider}:${score}`;
}

function getProviderLabel(provider: string) {
  const info = ProviderList.find((item) => item.key === provider);
  return info?.name ?? capitalize(provider);
}

const ProviderScoreSlider: FunctionComponent<SliderProps> = ({
  marks,
  provider,
  score,
  onChange,
}) => {
  const [value, setValue] = useState(score);

  useEffect(() => {
    setValue(score);
  }, [score]);

  return (
    <MantineSlider
      labelAlwaysOn
      marks={marks}
      max={100}
      min={0}
      style={{ minWidth: "12rem" }}
      value={value}
      onChange={setValue}
      onChangeEnd={(newValue) => onChange(provider, newValue)}
    ></MantineSlider>
  );
};

export const ProviderScoreExceptions: FunctionComponent<Props> = ({
  label,
  settingKey,
  defaultScoreKey,
}) => {
  const { setValue } = useFormActions();
  const marks = useSliderMarks([0, 100]);

  const defaultScore = useSettingValue<number>(defaultScoreKey) ?? 0;
  const enabledProviders =
    useSettingValue<string[]>("settings-general-enabled_providers") ??
    emptyList;
  const value = useSettingValue<string[]>(settingKey) ?? emptyList;
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const activeProviders = useMemo(
    () =>
      enabledProviders.filter((provider) =>
        ProviderList.some((item) => item.key === provider),
      ),
    [enabledProviders],
  );

  const exceptions = useMemo(
    () =>
      value
        .map(decodeProviderScoreException)
        .filter((item): item is ProviderScoreException => item !== null)
        .filter((item) => activeProviders.includes(item.provider))
        .filter(
          (item, index, items) =>
            items.findIndex((other) => other.provider === item.provider) ===
            index,
        ),
    [activeProviders, value],
  );

  useEffect(() => {
    const cleanValue = exceptions.map(encodeProviderScoreException);
    const changed =
      cleanValue.length !== value.length ||
      cleanValue.some((item, index) => item !== value[index]);

    if (changed) {
      setValue(cleanValue, settingKey);
    }
  }, [exceptions, setValue, settingKey, value]);

  const updateExceptions = useCallback(
    (nextExceptions: ProviderScoreException[]) => {
      setValue(nextExceptions.map(encodeProviderScoreException), settingKey);
    },
    [setValue, settingKey],
  );

  const addException = useCallback(() => {
    if (!selectedProvider) {
      return;
    }

    updateExceptions([
      ...exceptions,
      {
        provider: selectedProvider,
        score: defaultScore,
      },
    ]);
    setSelectedProvider(null);
  }, [defaultScore, exceptions, selectedProvider, updateExceptions]);

  const updateScore = useCallback(
    (provider: string, score: number) => {
      updateExceptions(
        exceptions.map((item) =>
          item.provider === provider ? { ...item, score } : item,
        ),
      );
    },
    [exceptions, updateExceptions],
  );

  const removeException = useCallback(
    (provider: string) => {
      updateExceptions(exceptions.filter((item) => item.provider !== provider));
    },
    [exceptions, updateExceptions],
  );

  const providerOptions = useMemo(
    () =>
      activeProviders
        .filter(
          (provider) =>
            !exceptions.some((exception) => exception.provider === provider),
        )
        .map((provider) => ({
          label: getProviderLabel(provider),
          value: provider,
        })),
    [activeProviders, exceptions],
  );
  const canAdd =
    selectedProvider !== null &&
    providerOptions.some((option) => option.value === selectedProvider);

  return (
    <>
      <Group align="end" gap="xs">
        <Selector
          clearable
          label={label}
          placeholder="Select provider"
          options={providerOptions}
          value={selectedProvider}
          onChange={setSelectedProvider}
          searchable
        ></Selector>
        <Button disabled={!canAdd} onClick={addException}>
          Add
        </Button>
      </Group>
      <Table tableLayout="fixed">
        <colgroup>
          <col style={{ width: "14rem" }} />
          <col />
          <col style={{ width: "3rem" }} />
        </colgroup>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Provider</Table.Th>
            <Table.Th>Minimum Score</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {exceptions.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text ta="center">No provider exceptions configured</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            exceptions.map((exception) => (
              <Table.Tr key={exception.provider}>
                <Table.Td>
                  <Text truncate>{getProviderLabel(exception.provider)}</Text>
                </Table.Td>
                <Table.Td>
                  <ProviderScoreSlider
                    marks={marks}
                    provider={exception.provider}
                    score={exception.score}
                    onChange={updateScore}
                  ></ProviderScoreSlider>
                </Table.Td>
                <Table.Td>
                  <Action
                    label="Remove"
                    icon={faTrash}
                    c="red"
                    onClick={() => removeException(exception.provider)}
                  ></Action>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </>
  );
};
