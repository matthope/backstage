/*
 * Copyright 2021 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Children,
  Fragment,
  isValidElement,
  ReactNode,
  ReactElement,
} from 'react';
import { getComponentData } from './componentData';
import { useApi, FeatureFlagsApi, featureFlagsApiRef } from '../apis';

function selectChildren(
  rootNode: ReactNode,
  featureFlagsApi: FeatureFlagsApi,
  selector?: (element: ReactElement<unknown>) => boolean,
  strictError?: string,
): Array<ReactElement<unknown>> {
  return Children.toArray(rootNode).flatMap(node => {
    if (!isValidElement(node)) {
      return [];
    }

    const { children } = node.props;

    if (node.type === Fragment) {
      return selectChildren(children, featureFlagsApi, selector, strictError);
    }

    if (getComponentData(node, 'core.featureFlagged')) {
      const { flag } = node.props as { flag: string };
      if (featureFlagsApi.isActive(flag)) {
        return selectChildren(
          node.props.children,
          featureFlagsApi,
          selector,
          strictError,
        );
      }
      return [];
    }

    if (selector === undefined || selector(node)) {
      return [node];
    }

    if (strictError) {
      throw new Error(strictError);
    }

    return selectChildren(
      node.props.children,
      featureFlagsApi,
      selector,
      strictError,
    );
  });
}

class ElementCollection {
  constructor(
    private readonly children: ReactNode,
    private readonly featureFlagsApi: FeatureFlagsApi,
  ) {}

  findByComponentData(query: { key: string; withStrictError?: string }) {
    const selection = selectChildren(
      this.children,
      this.featureFlagsApi,
      node => Boolean(getComponentData(node, query.key)),
      query.withStrictError,
    );
    return new ElementCollection(selection, this.featureFlagsApi);
  }

  listComponentData<T>(query: { key: string }): T[] {
    const selection = selectChildren(
      this.children,
      this.featureFlagsApi,
      node => Boolean(getComponentData(node, query.key)),
    );
    return selection
      .map(node => getComponentData<T>(node, query.key))
      .filter((data: T | undefined): data is T => Boolean(data));
  }

  listElements<Props extends { [name: string]: unknown }>(): Array<
    ReactElement<Props>
  > {
    return selectChildren(this.children, this.featureFlagsApi) as Array<
      ReactElement<Props>
    >;
  }
}

export function useElementCollection(children: ReactNode) {
  const featureFlagsApi = useApi(featureFlagsApiRef);
  return new ElementCollection(children, featureFlagsApi);
}
