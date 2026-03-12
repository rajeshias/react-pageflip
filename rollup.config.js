import autoprefixer from 'autoprefixer';
import postcss from 'rollup-plugin-postcss';
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    external: ['react', 'react-dom'],
    input: 'src/index.ts',
    watch: {
        include: 'src/**',
    },
    output: [
        {
            file: 'build/index.js',
            format: 'cjs',
            sourcemap: true,
        },
        {
            file: 'build/index.es.js',
            format: 'esm',
            sourcemap: true,
        },
    ],
    plugins: [
        resolve(),
        commonjs(),
        typescript({ useTsconfigDeclarationDir: true }),
        postcss({
            plugins: [autoprefixer()],
            minimize: true,
        }),
    ],
};
