const { provisionCatalog } = require("./catalog-store.cjs");

const KASULO_TENANT = Object.freeze({
  tenantId: "tenant_kasulo_rocha_pizzaria",
  restaurantId: "restaurant_kasulo_rocha_pizzaria",
  restaurantKey: "kasulo-rocha-pizzaria",
  restaurantName: "Kasulo Rocha Pizzaria",
});

const KASULO_OFFICIAL_MENU_URL = "https://www.kasulopizzaria.com.br/?m=1";
const KASULO_LOGO_URL =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiAsb73JVRuYDoR56VDuy5XnJukDRG7lQXOdbvl1Jje2qpa8F9SrYrjxUf077yMBKTOinZlatJ1zbkKs3LWjiaUHfOUMTF7kzxiEJQYtvrBdezQ4Lys1Zq0236XmrV1KrvSMbUuFYOMYY9MN8N1DpU4sGiVs11lOFZ41KgynOpbQsT9iuO3opsMaPBnG10/s320/kasulinho.png";

const OFFICIAL_MENU_ITEMS = Object.freeze([
  {
    "id": "1",
    "category": "salgadas",
    "name": "Lombo Canadense",
    "description": "Molho de tomate, muçarela, lombo, parmesão, palmito, catupiry, azeitonas verdes e orégano.",
    "price": 64.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi4MqBQU_tKWXWlD8B8u7GmIfppz7bP71HyE3ZURSC4vg2VPfXnoc7PLCM4kLcN_wgFxZtAVdHOnoy8M145Agru134fFLQY3d39BrirldQesAp8WLqLPIlA5JDCA0M-l4L0nZYdNwh2ysc4q-FqcjAMcCb98SR0ClxQRT_dpLbUr-eNRDFkFkz14wkUycA/s320/pizzaria-kasulo-franca-pizza-lombo-canadense.png"
  },
  {
    "id": "2",
    "category": "salgadas",
    "name": "Brócolis aos Quatro Queijos",
    "description": "Molho de tomate, muçarela, gorgonzola, parmesão, brócolis, catupiry, azeitonas verdes e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhP1ArBjIM_qb0qLPzJQCJh3IQWjnlEK_A92WKKPsFREyOBHAyUe5S_iSWr-NNPmexHlQLR427fgYytUsNAgdaVa83SPl2f_juvvCuwft-9yObN_BnvJPf82miwStqQtTulJyjpcU6r8IzAWLe6XedzbDqVgr431uDPt5qJhBV_iRFEs-4pKpej2MJlBGk/s320/pizzaria-kasulo-franca-brocolis-aos-quatro-queijos.png"
  },
  {
    "id": "3",
    "category": "salgadas",
    "name": "Marguerita",
    "description": "Molho de tomate, muçarela, rodelas de tomate, parmesão, azeitonas pretas, manjericão e orégano.",
    "price": 49.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjiGyBsTI39Hr_GO5qfcGOxyL-EXQi-9G9ca9QRN507hr97Mzvpp6HEuYNGU5NID1lt7affqLx2IU6DhETX0vevxYYhWqVxb5wDMfC-oSUkWfVlApGd1ERPzPDfh2IyR9hx2GttIS9D8W1MnsMJqXIIDn6AhQ1CPguL8_mBCSL5Wyn5uWZBpFcQ1dlv_tY/s320/pizzaria-kasulo-franca-pizza-marguerita.png"
  },
  {
    "id": "4",
    "category": "salgadas",
    "name": "Portuguesa",
    "description": "Molho de tomate, muçarela, presunto, ervilha, palmito, ovo, cebola, azeitonas pretas e orégano.",
    "price": 64.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgWA4Z7MYkXiKD6gosg8q4Xy8tpAVtqfVDyRUQ3S1l77oSxlO-6mtstwxm7I1IkAgt1vhEmkb9s2_l137L5YUTZGiG0ZaWpx61wIgZcLMOEJblsmSTqvudaQ1KTvmTFLmbSB2m7VGY4D1W9yjzR6-rh98LmspcLyMoB16oJ2YdIu319dYwojGRd0pr-WPM/s320/pizzaria-kasulo-franca-pizza-portuguesa.png"
  },
  {
    "id": "5",
    "category": "salgadas",
    "name": "Vegetariana",
    "description": "Molho de tomate, muçarela, champignon, milho, palmito, brócolis, tomate seco, azeitonas verdes e orégano.",
    "price": 64.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhAQ7HniAYbM3zy3lBMYF0j47I93tU-XvpCvvk-gZjwyd_V5it8oj8Vt4vf8wPSyvyDXj048OZHttp2I4NxRz1Q3IunT5e_WBVm159al5IjiSVPrfTqKJfABKmET6rP8RJBolt1GY9lna-Kz-SYNQ78DMSt0q31NR_5mxBkwTXgFIMq163f1D9MpJBT9V8/s320/pizzaria-kasulo-franca-pizza-vegetariana.png"
  },
  {
    "id": "6",
    "category": "salgadas",
    "name": "Baiana",
    "description": "Molho de tomate, muçarela, calabresa, ovo, pimenta dedo de moça, pimentão, azeitonas verdes e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi2Cx1iiwzyAq6anYB6ENBYk8A6dcyqjisKfpF20ODOGNAbO_Jt2s20TPAWqN9LLriyfCOa38TigK3pIB9v7_kiXutO_MVDCdpYWGpbnfbhLEvdjASvmLeVut_qoY9ie8PyhUH_j7Hpm2w2aH8HyNvIaOvq5TtJkyPyws_85C1Qnc2AAH3IfpH5nNb-uwE/s320/pizzaria-kasulo-franca-pizza-baiana.png"
  },
  {
    "id": "7",
    "category": "salgadas",
    "name": "Frango com Catupiry",
    "description": "Molho de tomate, muçarela, frango, milho, bacon, catupiry, azeitonas verdes e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjRFYzwws6j2rwmwU66g0sZb_nd_JklyHK5oLi3SXTvM_fouUnQSSEw8hjR0FtTxdnoOhXvZ4wNo6OxlGbeInhLFbF4gdkpyVCIKtPi7qsAxXdGOx5ZG1aIRn99X-o8SJwh9FElgxnkX-brMMnyQBjlXqxpoUp8QRvwaRW3-c3SpfRfSrbOMBGx67T8HgM/s320/pizzaria-kasulo-franca-frango-com-catupiry.png"
  },
  {
    "id": "8",
    "category": "salgadas",
    "name": "Quatro Queijos",
    "description": "Molho de tomate, muçarela, gorgonzola, parmesão, catupiry, azeitonas pretas e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7NE4bk_pO3ZZqkpIKn_iBVvQaXa-ojWe6qFFBxAIswRR4mNctnPmVPZrDKuyJ76EJlNMlzmKbNtl0QGDkgBz77qZ5fUqvGAevEzh08E5tIdJlXxrwBHEvK21KpW133iiua1J9fk2aXyWe835ofK0uZ7E3y4hsuwHKkOfNrreFUl3cvuUUYRlrrp71OTE/s320/pizzaria-kasulo-franca-pizza-quatro-queijos.png"
  },
  {
    "id": "9",
    "category": "salgadas",
    "name": "Peperoni",
    "description": "Molho de tomate, muçarela, peperoni, champignon, gorgonzola, cheeder, azeitonas verdes e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjnwsmCSTPOj_mQF2BmjV0K5Jd5eyYzADEFjTUu9XDGNMPXvhMmM3h28Bl1EjD-6bIXqar-qRPvqmVE1UR2x8Y81zwrTczdfqOH4vPmvn4aKnlmMndlEIfoGsptdrZLjaiaekhHGrMUnGT3mtWtMeVcLvAixZq2Q5Gzy4UHvy_iC_0VIjH4NhfLVpp0mMQ/s320/pizzaria-kasulo-franca-pizza-peperoni.png"
  },
  {
    "id": "10",
    "category": "salgadas",
    "name": "Calabresa com Catupiry",
    "description": "Molho de tomate, calabresa, muçarela, catupiry, cebola, azeitonas pretas e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEivie6kmuFrlMQQ5fB2L3B2slM-mA0B03p7cLC1tCA-UfvfdRVy7K2Ci2Eph523VmQ-wAOMxBWjJL4Vr-dLTI-b2orKw2hESZcGWopWsKuQ-n0BwS0h_hYKveOrEj-DVhT6gzlBg6Wc7g5nDf096K5pD9X6Wo7mnDrz5Fh3kzROV9UoWAlNP3uFgOJxQC4/s320/pizzaria-kasulo-franca-pizza-calabresa-com-catupiry.png"
  },
  {
    "id": "11",
    "category": "salgadas",
    "name": "Escarola",
    "description": "Molho de tomate, muçarela, escarola, bacon, parmesão, azeitonas pretas e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhuy4GpMQKmzABwyoX-_-XAbk2GWXKn6iMAgbs3VSVEHZaRFFzDZMJO8FlJ-AsaxSeUU5vGkS2b0iFO7r6CfHB3nZcvinzNLaeDp5Lqkh0cPg4BDSOi_X75dHBcdziDcbB3cvcG7TqBy8cUue2J8UxDuAuKJI6jiLLglgTkHc1hNr1_UM2C8Dp9BpitO-k/s320/pizzaria-kasulo-franca-pizza-escarola.png"
  },
  {
    "id": "12",
    "category": "salgadas",
    "name": "Palmito Especial",
    "description": "Molho de tomate, muçarela, parmesão, bacon, palmito, tomate seco, catupiry, azeitonas verdes e orégano.",
    "price": 64.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjMbbNqzaPKE57t8n3Zea7XXXtQzG2LkOp0jxWDI-p5dXYRyA6N8FzNKJ-8GavTd1pnISNJ6__8B8yxPnhscj3l7qsPiuDKLQ_ancSVYG2_rpkosYvsQnW2mzaWqKHtEeq0ytmby3qZ3JAsPyg4WY2tcumndXMHzyrfXfaBBMhR8QNrSbkKLQ8VRA5IQtE/s320/pizzaria-kasulo-franca-pizza-palmito-especial.png"
  },
  {
    "id": "13",
    "category": "salgadas",
    "name": "Frango Caipira",
    "description": "Molho de tomate, muçarela, frango caipira, millho, quiabo frito, bacon, catupiry, azeitonas verdes e orégano.",
    "price": 79.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj2rPfHzXEeGHEu67yr-dEx8e9BmBgWytuEYg2Kci8IHyK54rymNk-lGbUFwp2L0ycQn48yU9DgJrq0ovZMbjaulkCTayVDjSmDdA0ACBg2KDok_76AB_e3p1ravgEBIJ95GBQgrbRfT-LBB5zDpiNo-14zUgouBNGV76mtkMMbYVWfIV-SL-j6TQXttgU/s320/pizzaria-kasulo-frango-caipira.png"
  },
  {
    "id": "14",
    "category": "salgadas",
    "name": "Camarão",
    "description": "Molho de tomate, mussarela, catupiry, camarão, cheiro verde, alho frito, azeitonas verdes e orégano.",
    "price": 89.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgcyIko4Qd71GqMnk4ZZ6gwak6Mf7jv1catczeD6lK1nh8nU-vm4MbASzn0gRO2mSHI8tBCKYc78F70X3IoStLMZCQh7vLeSOcSyv2eo-orup96MCRX5m1kd4ys4opqqbVbUnGwwcj-SwFt8zIfhG2wZEmkvRr2QM8ZryVPpY7CVm4NQ0-M7git8fcElAQ/s320/pizzaria-kasulo-franca-pizza-camarao.png"
  },
  {
    "id": "15",
    "category": "salgadas",
    "name": "Milho com Catupiry",
    "description": "Molho de tomate, muçarela, milho, azeitonas verdes e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhUdh72flmyzNuG5HdbQBnmSLeSQ6ahDfdzCd95S6PIoheVGMTAHzhC8FNmfAeIVNJlnBWhOGjFUWXsx6N6IdLq0UHgGfr7arNLp6ZNt39T4iUr3p-KnmG5Xh2aIOJDJDj0X5kzgPEqDNlrmG43CY3XDRlU7Hfu6tcOL4z75je6B2wX9JT4IboYP3NKvPU/s320/pizzaria-kasulo-franca-milho-com-catupiry.png"
  },
  {
    "id": "16",
    "category": "salgadas",
    "name": "Brócolis com Bacon",
    "description": "Molho de tomate, muçarela, brócolis, bacon, azeitonas pretas e orégano.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhk4hA-7DDgpzSip8J0PPpw3_xBeDzZaISTbrHO91XvEGTCltTCrI9E1RmK-SpGL2RkCE8q49NT-cr0FGNL_8rFumEM78XJ48kEW76wg_iFRVO0Nu1gVSRTOn9agFvhaCpCmUPQknkPXdF_x9Q9MZZporJi90oxw9P9V4kGUFWwbrfCLMp7KaqMbYY9keQ/s320/pizzaria-kasulo-franca-brocolis-com-bacon.png"
  },
  {
    "id": "17",
    "category": "salgadas",
    "name": "Abobrinha com Tomate Cereja",
    "description": "Molho de tomate, muçarela, abobrinha refogada, tomate cereja e manjericão.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiARYG3bcMUJPRvdmeycOQ-Vy9dMYmKBBll2LFaVQGZojEcPO3heaVtzQnZYeNbn7uJT9Ju2491X5XJzkDuODPjdwB6FZaeYO-E0JhZqVPXMXDQrQpEPdQx0rjcb3zGNdTFcE6905nIxSRqERgSP0pmlk_xaG31wVKJsFBu17Q4FAz7PmGdm6LQ2w6wXuI/s320/kasulo-pizzaria-franca-abobrinha-com-tomate-cereja.png"
  },
  {
    "id": "18",
    "category": "salgadas",
    "name": "Muçarela",
    "description": "Molho de tomate, muçarela, orégano e azeitonas pretas.",
    "price": 54.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiChiGuUg0e9TmosZ-ziRmICie9KT4tT_80ki-0AkPryOZWC1YV7eDwEmekLlvyvDt_mDwftZH3SU8-k8p0Qfe2He_7eqbZJdQqhAHSJUeK2SXEhJYbcSDBLACvsZ7zmU70-AB_A3_sKtRK4FwBZeMzdnkQ5-rWNCs9KQhU9zrOMooI9kLtbQXuYr5f8Ms/s320/pizzaria-kasulo-franca-mucarela.png"
  },
  {
    "id": "19",
    "category": "salgadas",
    "name": "Apimentada com Atum e Aliche",
    "description": "Molho de tomate, pimenta calabresa, calabresa, muçarela, atum ralado, aliche, azeitonas verdes e orégano.",
    "price": 59.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEibjxlu_UegfmYRJlcpkw6jWqZu09HJ9vI2kzAOv2EqrEzKFOf9zZdyALrb_zAGrRUdmSeCSWlZ_qrZEMCQyCnDFgLA_NNh1BboEXZqDjvyXcERHC4QB2fIYO2P7xE3371KzRxwPTVn4cpoaQGl9tSLzAHzGuycdX4nm-qEY2tpJ9f9urjlXVzW12mgGS0/s320/pizzaria-kasulo-franca-apimentada-com-atum-e-aliche.png"
  },
  {
    "id": "20",
    "category": "salgadas",
    "name": "Bacalhau do Chefe",
    "description": "Molho de tomate, muçarela, bacalhau, cebola, ovo, pimentão, azeitonas pretas e orégano.",
    "price": 89.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiOxZcxPrVBPuK_QiVM3iaGG_6ADIoVELHgZFMeiK_4EMJTuRfpjLSXCe1rn3CpfaOhj6DxWpLvfIffPGI0RIdRxTATEukn3MLMIUYbCx8wwRPvwAukRKqfo8MmRKjingobcz2b0IeDnK7fjEc3cKIPW8IliAXXHsisXyaAK-SoTPZaForXV3I6nfzU9wk/s320/pizzaria-kasulo-franca-bacalhau-do-chefe.png"
  },
  {
    "id": "21",
    "category": "doces",
    "name": "Pizza doce de Bombom",
    "description": "Acompanha sorvete de morango, cobertura, recheio de Nutella e bombom Sonho de Valsa.",
    "price": 49.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgTKrfIEdqmzy1-UlYtEjm_iK_5Y6R4NslyI9ymUiKJ0j2lBrL6_0lI_VhUxKxusLXLd01rblPGRPXhfCu7K6e-KIqvjjXfBKd8JEZDCcpdZJe6Q89f-o5XlcmXUvQQZofUGUAG8U2dJQNQDcn_ZHgqr9QqQO8NIkHJ-u012d_AiBnPSXUVItT0ZkdQQpE/s320/pizzaria-kasulo-franca-pizza-bombom.png"
  },
  {
    "id": "22",
    "category": "doces",
    "name": "Pizza de Chocolate com Avelã",
    "description": "Acompanha sorvete de avelã, cobertura e recheio de Nutella.",
    "price": 49.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgDCCiEZChDYhfLg8sJOGbc3yOn4kIyQRnuZmq1VXY4HLUYt-3eb9gkH80KoOFJ91eUdkk_EeU-hkHyY_YmvFnNBZZ7bOK5GU4KB2hM0jYFcSvi1wHHJpnv4ixKNmoJgdZAA7nR_AqTqFmTX9VNeazp0_TscvPEDWN7X1-veHSXyE2v08UFl5XNsl-2x7Y/s320/pizzaria-kasulo-franca-pizza-chocolate-com-avela.png"
  },
  {
    "id": "23",
    "category": "doces",
    "name": "Pizza de Banana com Canela",
    "description": "Acompanha sorvete de creme, banana com canela e cobertura de caramelo.",
    "price": 49.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhyuDqJ5CCCzVOqKxksWxx7XtyQGlzz7OnyZAVkMJTJu_1TQnO4xzfQlN-h92FhnEq96nioZ7oA3mAoMxUpJd3bu8zBzq07sc3XMPwEOrcMmTpC7Fi1AatNDECp16uFniKnL9ICCOHj2Eg3J3ZRLjQuvS5c79dCECdOOM-Wh466_o4NJFSSCjCMgn0Jmp8/s320/pizzaria-kasulo-franca-banana-com-canela.png"
  },
  {
    "id": "24",
    "category": "bebidas",
    "name": "Coca-Cola Lata 350ml",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 5.99,
    "image": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600"
  },
  {
    "id": "25",
    "category": "bebidas",
    "name": "Coca-Cola 2L",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 18.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgZrpuD_azUV6x-qd6ftLU7ItCmcLoriR3vFcRI9FfH0-4IacJJ2LULI5-gpK0g_rRPlhC1elNLHe7CoMXkMOkwSdFS1HISGjntUofDWJvNVC4pni74TQxEGnk5diAoF5XQ6ET6z6fDn0sDL0OFg1vQwR-4cj_Biz0z96Rkb8_U82U02Tz8N-qhUI3tQfE/s320/pizzaria-kasulo-coca-cola-2l.png"
  },
  {
    "id": "26",
    "category": "bebidas",
    "name": "Coca-Cola 600ml",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 11.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhZA7Gb-dP-KZE02gyZCXsCtxf_1C1mJkytq4-pbNreuj093RKYZpUgic1fc1fVGCS2_tihdoLQpj53xjyZdLX8MSinoq_jBzqIH6k8yWaiBeBhcqYYbDBxdw-nmW7eHPOhREUSnPeyDiUt0Zorzrkl-SMGcFVcc2PZ3C2Mnag4IGckpQFoP-LKoo_HbEA/s320/pizzaria-kasulo-coca-600ml-original.png"
  },
  {
    "id": "27",
    "category": "bebidas",
    "name": "Coca-Cola 600ml Zero",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 11.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjOrtH9MTiZ_fzGkNbmk4ovNC7pNPiUxmb95cFicS7rHNlN-md0mXJPafrArqCh39uA82D3g6VrE4s0h9eyNWC3pJZw-373f4lIX54-NZY8R8u6BG5COVoRLFNqNbmn1k86XG-R8FruTqEYTzsPuNrZp5smZzW__cEjb8B0Pfs9VHqUEazJ14huK-Lp-PQ/s320/pizzaria-kasulo-coca-600ml-zero.png"
  },
  {
    "id": "28",
    "category": "bebidas",
    "name": "Guaraná Antarctica 1L",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 11.99,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgPls_4GuD5agqn-jBNoCnN4X7fsci88B_0SHxb53mhLV17YfmTBYP5eMoDCVX_ngta0qpQA_7UARpfusibp6A2LzeocNFUVQbWI3-Kf2NMxnXsCraN2EdVqKkCV2Kz8YYaDvo9a_7bUE2DZ4IjNpT3zD6fp7VKhVG_MsyIcMofB1PCqMed9rQ_2wp3Bcw/s320/pizzaria-kasulo-guarana1l.png"
  },
  {
    "id": "29",
    "category": "bebidas",
    "name": "H2OH! Limão 500ml",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 7.49,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjO8fEpjyYYz6DmuX9G4XWOvOF_fW4RX7VcBv7dJZyrTpmM4Od5R2_fETNQJ1qcYNh9arv3wJB7oXz6ozfTdA9qpWRl8UW4IbTUKrIhrRS1BAA-yF2l8PbQt2_6eQYsNRRSRRpIqX46biqgSBpIH-gTRfZMlFSHfQY0hErh5Les9EHwK5VrWJ-y9LqECCU/s320/pizzaria-kasulo-franca-h2oh.png"
  },
  {
    "id": "30",
    "category": "bebidas",
    "name": "H2OH! Limoneto 500ml",
    "description": "Refrigerante gelado para acompanhar.",
    "price": 7.49,
    "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhKZnyOSLq-FWvmcF5ocvOYi2VTIhsOa18hZZz0y0GMyCo4Y0o313PUY18ZxOEXbn_mrPsG9xuKKr8CoSFwm7c523_aRGd7i0M5YdFsaNwnRVbotlmavtt6-2epAEB5TiF8hUpdEwyhznfL99k56SJTNNw3Kqj3lUHH4mKUrqhHrdKGqW3u4yKnslAb2zY/s320/kasulo-pizzaria-franca-limoneto.png"
  }
]);

const CATEGORY_METADATA = Object.freeze({
  salgadas: {
    id: "pizzas-salgadas",
    kicker: "Pizzas",
    title: "Pizzas Salgadas",
    description: "Sabores salgados do cardápio oficial Kasulo Rocha.",
    category: "Pizzas Salgadas",
  },
  doces: {
    id: "pizzas-doces",
    kicker: "Sobremesa",
    title: "Pizzas Doces",
    description: "Pizzas doces do cardápio oficial Kasulo Rocha.",
    category: "Pizzas Doces",
  },
  bebidas: {
    id: "bebidas",
    kicker: "Bebidas",
    title: "Bebidas",
    description: "Bebidas geladas para acompanhar.",
    category: "Bebidas",
  },
});

const normalizeOfficialItem = (item) => {
  const metadata = CATEGORY_METADATA[item.category];
  return {
    id: `kasulo-menu-${item.id}`,
    name: item.name,
    category: metadata.category,
    description: item.description,
    detail: "Cardápio oficial",
    image: item.image,
    badge: "",
    price: item.price,
    basePrice: item.price,
    isAvailable: true,
    isPaused: false,
    isPromoted: false,
    isHighlighted: ["1", "13", "21"].includes(item.id),
    salesChannels: ["delivery", "pickup", "dining"],
  };
};

const DINING_ONLY_ITEMS = Object.freeze([
  {
    id: "rodizio-tradicional",
    name: "Rodízio Tradicional",
    description: "Rodízio tradicional de pizza.",
    price: 59.99,
  },
  {
    id: "rodizio-com-file",
    name: "Rodízio com Filé",
    description: "Inclui Guaraná Antarctica 1L e suco de limão.",
    price: 74.99,
  },
  {
    id: "rodizio-especial",
    name: "Rodízio Especial",
    description: "Inclui Guaraná Antarctica 1L e suco de limão.",
    price: 99.9,
  },
  {
    id: "taxa-infantil-5-a-10-anos",
    name: "Taxa Infantil",
    description: "Rodízio infantil para crianças de 5 a 10 anos.",
    price: 35,
  },
]);

const buildKasuloCatalog = () => {
  const officialSections = Object.entries(CATEGORY_METADATA).map(([categoryKey, metadata]) => ({
    id: metadata.id,
    kicker: metadata.kicker,
    title: metadata.title,
    description: metadata.description,
    items: OFFICIAL_MENU_ITEMS.filter((item) => item.category === categoryKey).map(
      normalizeOfficialItem
    ),
  }));
  const sections = [
    {
      id: "rodizio-salao",
      kicker: "Somente no salão",
      title: "Rodízio",
      description: "Itens por pessoa, exclusivos da operação presencial.",
      items: DINING_ONLY_ITEMS.map((item) => ({
        ...item,
        category: "Rodízio",
        detail: item.id.startsWith("taxa-infantil") ? "Crianças de 5 a 10 anos" : "Produto por pessoa",
        image: KASULO_LOGO_URL,
        badge: "Somente salão",
        basePrice: item.price,
        isAvailable: true,
        isPaused: false,
        isPromoted: false,
        isHighlighted: false,
        salesChannels: ["dining"],
      })),
    },
    ...officialSections,
  ];

  return {
    sections,
    sectionDisplayOrder: sections.map((section) => section.id),
    featuredItemId: "kasulo-menu-1",
    featuredItemIds: ["kasulo-menu-1", "kasulo-menu-13", "kasulo-menu-21"],
  };
};

const provisionKasuloCatalog = (actor = {}) =>
  provisionCatalog(buildKasuloCatalog(), actor, {
    tenantContext: KASULO_TENANT,
  });

module.exports = {
  KASULO_LOGO_URL,
  KASULO_OFFICIAL_MENU_URL,
  KASULO_TENANT,
  buildKasuloCatalog,
  provisionKasuloCatalog,
};

